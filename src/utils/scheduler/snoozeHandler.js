import { DateTime } from 'luxon';
import { doc, updateDoc, serverTimestamp, Timestamp, increment } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
	REMINDER_STATUS,
	SNOOZE_OPTIONS,
	DEFAULT_MAX_SNOOZE_ATTEMPTS,
	FREQUENCY_SNOOZE_LIMITS,
	SNOOZE_INDICATORS,
	SNOOZE_LIMIT_MESSAGES,
	PATTERN_TRACKING,
	OPTION_TYPES,
} from '../../../constants/notificationConstants';
import { SchedulingService } from './scheduler';
import {
	updateContactScheduling,
	getUserPreferences,
	getActiveReminders,
	getContactById,
	getReminder,
} from '../firestore';
import { schedulingHistory } from './schedulingHistory';
import NetInfo from '@react-native-community/netinfo';

// Get max snooze attempts based on frequency
function getMaxSnoozeAttemptsForFrequency(frequency) {
	return FREQUENCY_SNOOZE_LIMITS[frequency] || DEFAULT_MAX_SNOOZE_ATTEMPTS;
}

// Calculate snooze stats from a reminder object
function computeSnoozeStats(reminder) {
	const frequency = reminder?.frequency || 'default';
	const snoozeCount = reminder?.snooze_count || reminder?.snooze_history?.length || 0;
	const maxAllowed = getMaxSnoozeAttemptsForFrequency(frequency);
	const remaining = Math.max(0, maxAllowed - snoozeCount);

	return {
		remaining,
		total: maxAllowed,
		isLast: remaining === 1,
		isExhausted: remaining === 0,
		message:
			remaining > 1
				? SNOOZE_LIMIT_MESSAGES.REMAINING(remaining)
				: remaining === 1
				? SNOOZE_LIMIT_MESSAGES.LAST_REMAINING
				: SNOOZE_LIMIT_MESSAGES.MAX_REACHED,
		indicator:
			remaining > 1
				? SNOOZE_INDICATORS.NORMAL
				: remaining === 1
				? SNOOZE_INDICATORS.WARNING
				: SNOOZE_INDICATORS.CRITICAL,
		frequencySpecific:
			frequency === 'daily'
				? SNOOZE_LIMIT_MESSAGES.DAILY_LIMIT
				: frequency === 'weekly'
				? SNOOZE_LIMIT_MESSAGES.WEEKLY_LIMIT
				: null,
	};
}

export class SnoozeHandler {
	constructor(userId, timezone) {
		this.userId = userId;
		this.timezone = timezone;
		this.schedulingService = null;
		this.patternCache = new Map();
		this.previouslyConnected = true;
	}

	async initialize() {
		if (!this.userId) {
			throw new Error('User ID is required for initialization');
		}

		try {
			const userPrefs = await getUserPreferences(this.userId);
			if (!userPrefs) {
				throw new Error('Failed to load user preferences');
			}

			const activeReminders = await getActiveReminders(this.userId);

			this.schedulingService = new SchedulingService(
				userPrefs.scheduling_preferences || {
					minimumGapMinutes: 20,
					preferredTimeSlots: [],
					timezone: this.timezone || DateTime.local().zoneName,
				},
				activeReminders || [],
				this.timezone || DateTime.local().zoneName
			);

			await schedulingHistory.initialize();

			if (!this.schedulingService) {
				throw new Error('Failed to initialize scheduling service');
			}

			return true;
		} catch (error) {
			console.error('Error initializing SnoozeHandler:', error);
			throw error;
		}
	}

	async getAnalysisWindow(contactId) {
		try {
			const contact = await getContactById(contactId);
			const frequency = contact?.scheduling?.frequency || 'monthly';

			switch (frequency) {
				case 'weekly':
					return PATTERN_TRACKING.TIME_WINDOW.MIN;
				case 'biweekly':
					return PATTERN_TRACKING.TIME_WINDOW.MIN * 2;
				case 'monthly':
					return PATTERN_TRACKING.TIME_WINDOW.DEFAULT;
				case 'quarterly':
					return PATTERN_TRACKING.TIME_WINDOW.MAX;
				default:
					return PATTERN_TRACKING.TIME_WINDOW.DEFAULT;
			}
		} catch (error) {
			return PATTERN_TRACKING.TIME_WINDOW.DEFAULT;
		}
	}

	async findOptimalTime(contactId, baseTime, snoozeType) {
		try {
			const patterns = await schedulingHistory.analyzeContactPatterns(contactId);
			if (!patterns?.successRates?.byHour) return null;

			const hour = baseTime.hour;
			const periodRates = Object.entries(patterns.successRates.byHour)
				.filter(([h]) => {
					const hourNum = parseInt(h);
					return Math.abs(hourNum - hour) <= 3;
				})
				.sort(([, a], [, b]) => b.successRate - a.successRate);

			if (periodRates.length > 0) {
				return baseTime.set({ hour: parseInt(periodRates[0][0]), minute: 0 });
			}

			return baseTime.plus({ hours: 3 });
		} catch (error) {
			console.error('Error finding optimal time:', error);
			return null;
		}
	}

	async handleLaterToday(
		contactId,
		currentTime = DateTime.now(),
		reminderType = 'SCHEDULED',
		reminderId = null
	) {
		try {
			if (!this.schedulingService) await this.initialize();
			if (!this.schedulingService) {
				throw new Error('Failed to initialize scheduling service');
			}

			const hour = currentTime.hour;
			let minMinutes, maxMinutes;

			if (hour >= 0 && hour < 4) {
				minMinutes = 20;
				maxMinutes = 40;
			} else if (hour >= 21 || hour < 0) {
				minMinutes = 20;
				maxMinutes = 40;
			} else if (hour >= 19) {
				minMinutes = 50;
				maxMinutes = 80;
			} else if (hour >= 17) {
				minMinutes = 120;
				maxMinutes = 150;
			} else {
				minMinutes = 150;
				maxMinutes = 210;
			}

			const minutesToAdd = Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
			const proposedTime = currentTime.plus({ minutes: minutesToAdd }).toJSDate();

			const availableTime = await this.schedulingService.findAvailableTimeSlot(proposedTime, {
				id: contactId,
			});

			if (reminderId) {
				await updateDoc(doc(db, 'reminders', reminderId), {
					scheduledTime: Timestamp.fromDate(availableTime),
					status: REMINDER_STATUS.SNOOZED,
					updated_at: serverTimestamp(),
					snoozed: true,
					snooze_count: increment(1),
				});
			}

			await updateContactScheduling(contactId, {
				status: REMINDER_STATUS.SNOOZED,
				last_snooze_type: 'later_today',
				snooze_count: increment(1),
			});

			await schedulingHistory.trackSnooze(
				contactId,
				currentTime,
				DateTime.fromJSDate(availableTime),
				'later_today'
			);

			if (availableTime) {
				const contact = await getContactById(contactId);
				const reminderData = {
					id: reminderId || contactId,
					contactName: `${contact.first_name} ${contact.last_name}`,
					scheduledTime: availableTime,
					contact_id: contactId,
					user_id: this.userId,
					type: reminderType,
				};
				await this.schedulingService.scheduleNotificationForReminder(reminderData);
			}
			return availableTime;
		} catch (error) {
			console.error('Error in handleLaterToday:', error);
			throw error;
		}
	}

	async handleTomorrow(
		contactId,
		currentTime = DateTime.now(),
		reminderType = 'SCHEDULED',
		reminderId = null
	) {
		try {
			if (!this.schedulingService) await this.initialize();

			const optimalTime = await this.findOptimalTime(contactId, currentTime, 'tomorrow');

			let proposedTime;
			if (optimalTime) {
				proposedTime = optimalTime.plus({ days: 1 }).toJSDate();
			} else {
				proposedTime = currentTime.plus({ days: 1 }).toJSDate();
			}

			const availableTime = await this.schedulingService.findAvailableTimeSlot(proposedTime, {
				id: contactId,
			});

			if (reminderId) {
				await updateDoc(doc(db, 'reminders', reminderId), {
					scheduledTime: Timestamp.fromDate(availableTime),
					status: REMINDER_STATUS.SNOOZED,
					updated_at: serverTimestamp(),
					snoozed: true,
					snooze_count: increment(1),
				});
			}

			await updateContactScheduling(contactId, {
				status: REMINDER_STATUS.SNOOZED,
				last_snooze_type: 'tomorrow',
				snooze_count: increment(1),
			});

			await schedulingHistory.trackSnooze(
				contactId,
				currentTime,
				DateTime.fromJSDate(availableTime),
				'tomorrow'
			);

			if (availableTime) {
				const contact = await getContactById(contactId);
				const reminderData = {
					id: reminderId || contactId,
					contactName: `${contact.first_name} ${contact.last_name}`,
					scheduledTime: availableTime,
					contact_id: contactId,
					user_id: this.userId,
					type: reminderType,
				};
				await this.schedulingService.scheduleNotificationForReminder(reminderData);
			}
			return availableTime;
		} catch (error) {
			console.error('Error in handleTomorrow:', error);
			throw error;
		}
	}

	async handleNextWeek(
		contactId,
		currentTime = DateTime.now(),
		reminderType = 'SCHEDULED',
		reminderId = null
	) {
		try {
			if (!this.schedulingService) {
				await this.initialize();
			}

			if (!this.schedulingService) {
				throw new Error('Failed to initialize scheduling service');
			}

			if (!contactId) {
				throw new Error('Contact ID is required');
			}

			const optimalTime = await this.findOptimalTime(contactId, currentTime.plus({ weeks: 1 }), 'next_week');
			let proposedTime = optimalTime ? optimalTime.toJSDate() : currentTime.plus({ weeks: 1 }).toJSDate();

			const availableTime = await this.schedulingService.findAvailableTimeSlot(proposedTime, {
				id: contactId,
			});

			if (!availableTime) {
				throw new Error('No available time slot found');
			}

			if (reminderId) {
				await updateDoc(doc(db, 'reminders', reminderId), {
					scheduledTime: Timestamp.fromDate(availableTime),
					status: REMINDER_STATUS.SNOOZED,
					updated_at: serverTimestamp(),
					snoozed: true,
					snooze_count: increment(1),
				});
			}

			await updateContactScheduling(contactId, {
				status: REMINDER_STATUS.SNOOZED,
				last_snooze_type: 'next_week',
				snooze_count: increment(1),
			});

			await schedulingHistory.trackSnooze(
				contactId,
				currentTime,
				DateTime.fromJSDate(availableTime),
				'next_week'
			);

			if (availableTime) {
				const contact = await getContactById(contactId);
				if (!contact) {
					throw new Error('Contact not found');
				}

				const reminderData = {
					id: reminderId || contactId,
					contactName: `${contact.first_name} ${contact.last_name}`,
					scheduledTime: availableTime,
					contact_id: contactId,
					user_id: this.userId,
					type: reminderType,
				};

				await this.schedulingService.scheduleNotificationForReminder(reminderData);
			}

			return availableTime;
		} catch (error) {
			console.error('Error in handleNextWeek:', error);
			throw error;
		}
	}

	async handleSkip(contactId, currentTime = DateTime.now(), reminderId = null) {
		try {
			if (reminderId) {
				await updateDoc(doc(db, 'reminders', reminderId), {
					status: REMINDER_STATUS.SKIPPED,
					updated_at: serverTimestamp(),
					snoozed: false,
				});
			}

			await updateContactScheduling(contactId, {
				status: REMINDER_STATUS.SKIPPED,
				last_snooze_type: 'skip',
				custom_next_date: null,
			});

			await schedulingHistory.trackSkip(contactId, currentTime);
			return true;
		} catch (error) {
			console.error('Error in handleSkip:', error);
			throw error;
		}
	}

	async handleSnooze(
		contactId,
		option,
		currentTime = DateTime.now(),
		reminderType = 'SCHEDULED',
		reminderId = null
	) {
		if (!contactId) {
			throw new Error('Contact ID is required');
		}

		currentTime = DateTime.isDateTime(currentTime) ? currentTime : DateTime.now();

		const snoozeOption = SNOOZE_OPTIONS.find((opt) => opt.id === option);
		if (!snoozeOption) throw new Error('Invalid snooze option');

		switch (option) {
			case 'later_today':
				return this.handleLaterToday(contactId, currentTime, reminderType, reminderId);
			case 'tomorrow':
				return this.handleTomorrow(contactId, currentTime, reminderType, reminderId);
			case 'next_week':
				return this.handleNextWeek(contactId, currentTime, reminderType, reminderId);
			case 'skip':
				return this.handleSkip(contactId, currentTime, reminderId);
			default:
				throw new Error('Unsupported snooze option');
		}
	}

	async getAvailableSnoozeOptions(reminderId) {
		const allOptions = [
			{
				id: 'later_today',
				icon: 'time-outline',
				text: 'Later Today',
			},
			{
				id: 'tomorrow',
				icon: 'calendar-outline',
				text: 'Tomorrow',
			},
			{
				id: 'next_week',
				icon: 'calendar-clear-outline',
				text: 'Next Week',
			},
			{
				id: 'skip',
				icon: 'close-circle-outline',
				text: 'Skip This Call',
			},
			{
				id: OPTION_TYPES.CONTACT_NOW,
				icon: 'call-outline',
				text: 'Contact Now',
			},
			{
				id: OPTION_TYPES.RESCHEDULE,
				icon: 'refresh-outline',
				text: 'Reschedule',
			},
		];

		try {
			// Check network status
			const networkState = await NetInfo.fetch();
			const isOffline = !networkState.isConnected;

			// Get reminder details
			const reminder = await getReminder(reminderId);
			if (!reminder) {
				console.warn('Reminder not found, returning standard options');
				return allOptions
					.filter((o) => ['later_today', 'tomorrow', 'next_week', 'skip'].includes(o.id))
					.map((o) => ({ ...o, offline: isOffline }));
			}

			// Calculate snooze stats
			const stats = computeSnoozeStats(reminder);
			const frequency = reminder?.frequency || 'default';

			// DAILY REMINDERS SPECIAL HANDLING
			if (frequency === 'daily') {
				if (stats.remaining > 0) {
					// Daily reminders with remaining snoozes - only offer "Later Today" or "Skip"
					return allOptions
						.filter((o) => o.id === 'later_today' || o.id === 'skip')
						.map((o) => ({
							...o,
							stats,
							offline: isOffline,
						}));
				} else {
					// Daily reminders with no remaining snoozes - offer "Contact Now" or "Skip"
					return allOptions
						.filter((o) => o.id === OPTION_TYPES.CONTACT_NOW || o.id === 'skip')
						.map((o) => ({
							...o,
							stats: {
								...stats,
								frequencySpecific: SNOOZE_LIMIT_MESSAGES.DAILY_MAX_REACHED,
								message: SNOOZE_LIMIT_MESSAGES.MAX_REACHED,
							},
							offline: isOffline,
						}));
				}
			}

			// WEEKLY REMINDERS - more limited options
			if (frequency === 'weekly') {
				const baseOptions = allOptions.filter(
					(o) => o.id === 'later_today' || o.id === 'tomorrow' || o.id === 'skip'
				);

				if (stats.isExhausted) {
					// Reschedule option for exhausted weekly reminders
					baseOptions.push(allOptions.find((o) => o.id === OPTION_TYPES.RESCHEDULE));

					return baseOptions.map((o) => ({
						...o,
						stats: {
							...stats,
							message: SNOOZE_LIMIT_MESSAGES.RECURRING_MAX_REACHED,
						},
						offline: isOffline,
					}));
				}

				return baseOptions.map((o) => ({
					...o,
					stats,
					offline: isOffline,
				}));
			}

			// OTHER FREQUENCIES
			if (stats.isExhausted) {
				// When exhausted, show limited snooze options + reschedule
				return [
					...allOptions
						.filter((o) => o.id === 'later_today' || o.id === 'tomorrow' || o.id === 'skip')
						.map((o) => ({
							...o,
							stats: {
								...stats,
								message: SNOOZE_LIMIT_MESSAGES.RECURRING_MAX_REACHED,
							},
							offline: isOffline,
						})),
					{
						...allOptions.find((o) => o.id === OPTION_TYPES.RESCHEDULE),
						stats: {
							...stats,
							message: SNOOZE_LIMIT_MESSAGES.RECURRING_MAX_REACHED,
						},
						offline: isOffline,
					},
				];
			}

			// Normal case - show all standard options
			return allOptions
				.filter((o) => ['later_today', 'tomorrow', 'next_week', 'skip'].includes(o.id))
				.map((o) => ({
					...o,
					stats,
					offline: isOffline,
				}));
		} catch (error) {
			console.error('Error getting snooze options:', error);
			return allOptions.filter((o) => ['later_today', 'tomorrow', 'next_week', 'skip'].includes(o.id));
		}
	}

	clearPatternCache() {
		this.patternCache.clear();
	}
}

export const snoozeHandler = new SnoozeHandler();

export const initializeSnoozeHandler = async (userId) => {
	snoozeHandler.userId = userId;
	await snoozeHandler.initialize();
};

// Export utility functions
export { computeSnoozeStats, getMaxSnoozeAttemptsForFrequency };
