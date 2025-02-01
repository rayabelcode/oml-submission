import { DateTime } from 'luxon';
import { doc, updateDoc, serverTimestamp, Timestamp, increment } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
	REMINDER_STATUS,
	SNOOZE_OPTIONS,
	MAX_SNOOZE_ATTEMPTS,
	PATTERN_TRACKING,
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

export class SnoozeHandler {
	constructor(userId, timezone) {
		this.userId = userId;
		this.timezone = timezone;
		this.schedulingService = null;
		this.patternCache = new Map(); // Cache pattern analysis results
	}

	async initialize() {
		if (!this.userId) {
			throw new Error('User ID is required for initialization');
		}

		try {
			// Get user preferences with fallback
			const userPrefs = await getUserPreferences(this.userId);
			if (!userPrefs) {
				throw new Error('Failed to load user preferences');
			}

			// Get active reminders with fallback
			const activeReminders = await getActiveReminders(this.userId);

			// Create scheduling service with guaranteed preferences
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

	// Get time window based on contact frequency
	async getAnalysisWindow(contactId) {
		try {
			const contact = await getContactById(contactId);
			const frequency = contact?.scheduling?.frequency || 'monthly';

			// Adjust window based on contact frequency
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

	// Patterns by time period
	async findOptimalTime(contactId, baseTime, snoozeType) {
		try {
			const patterns = await schedulingHistory.analyzeContactPatterns(contactId);
			if (!patterns?.successRates?.byHour) return null;

			// Get success rates for current time period
			const hour = baseTime.hour;
			const periodRates = Object.entries(patterns.successRates.byHour)
				.filter(([h]) => {
					const hourNum = parseInt(h);
					// Look within same time period (morning/afternoon/evening)
					return Math.abs(hourNum - hour) <= 3;
				})
				.sort(([, a], [, b]) => b.successRate - a.successRate);

			if (periodRates.length > 0) {
				return baseTime.set({ hour: parseInt(periodRates[0][0]), minute: 0 });
			}

			return baseTime.plus({ hours: 3 }); // fallback
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

			// Keep existing time calculation logic
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

			// Only update the reminder document
			if (reminderId) {
				await updateDoc(doc(db, 'reminders', reminderId), {
					scheduledTime: Timestamp.fromDate(availableTime),
					status: REMINDER_STATUS.SNOOZED,
					updated_at: serverTimestamp(),
					snoozed: true,
					snooze_count: increment(1),
				});
			}

			// Track for analytics
			await schedulingHistory.trackSnooze(
				contactId,
				currentTime,
				DateTime.fromJSDate(availableTime),
				'later_today'
			);

			// Schedule new local notification
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

			// Only update the reminder document
			if (reminderId) {
				await updateDoc(doc(db, 'reminders', reminderId), {
					scheduledTime: Timestamp.fromDate(availableTime),
					status: REMINDER_STATUS.SNOOZED,
					updated_at: serverTimestamp(),
					snoozed: true,
					snooze_count: increment(1),
				});
			}

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

			// Only update the reminder document
			if (reminderId) {
				await updateDoc(doc(db, 'reminders', reminderId), {
					scheduledTime: Timestamp.fromDate(availableTime),
					status: REMINDER_STATUS.SNOOZED,
					updated_at: serverTimestamp(),
					snoozed: true,
					snooze_count: increment(1),
				});
			}

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
			// Only update the reminder document
			if (reminderId) {
				await updateDoc(doc(db, 'reminders', reminderId), {
					status: REMINDER_STATUS.SKIPPED,
					updated_at: serverTimestamp(),
					snoozed: false,
				});
			}

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

		// Make sure currentTime is a DateTime object
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

	// Snooze options based on reminder frequency
	async getAvailableSnoozeOptions(reminderId) {
		// Default options that will always be available
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
				icon: 'calendar-outline',
				text: 'Next Week',
			},
			{
				id: 'skip',
				icon: 'close-circle-outline',
				text: 'Skip This Call',
			},
		];

		try {
			const reminder = await getReminder(reminderId);
			if (!reminder) {
				console.warn('Reminder not found, returning all options');
				return allOptions;
			}

			const frequency = reminder?.frequency;
			const snoozeCount = reminder?.snooze_count || 0;

			if (snoozeCount >= MAX_SNOOZE_ATTEMPTS) {
				return allOptions.filter((opt) => opt.id === 'skip');
			}

			switch (frequency) {
				case 'daily':
					return snoozeCount > 0
						? allOptions.filter((opt) => opt.id === 'skip')
						: allOptions.filter((opt) => opt.id === 'later_today' || opt.id === 'skip');

				case 'weekly':
					return allOptions.filter(
						(opt) => opt.id === 'later_today' || opt.id === 'tomorrow' || opt.id === 'skip'
					);

				default:
					return allOptions;
			}
		} catch (error) {
			console.error('Error getting snooze options:', error);
			// Return all options if there's an error, rather than an empty array
			return allOptions;
		}
	}

	clearPatternCache() {
		this.patternCache.clear();
	}
}

export const snoozeHandler = new SnoozeHandler();

// Method to set the userId
export const initializeSnoozeHandler = async (userId) => {
	snoozeHandler.userId = userId;
	await snoozeHandler.initialize();
};
