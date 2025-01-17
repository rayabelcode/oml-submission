import { DateTime } from 'luxon';
import {
	REMINDER_STATUS,
	SNOOZE_OPTIONS,
	MAX_SNOOZE_ATTEMPTS,
	PATTERN_TRACKING,
} from '../../constants/notificationConstants';
import { SchedulingService } from './scheduler';
import { updateContactScheduling, getUserPreferences, getActiveReminders, getContactById } from './firestore';
import { schedulingHistory } from './schedulingHistory';

export class SnoozeHandler {
	constructor(userId, timezone) {
		this.userId = userId;
		this.timezone = timezone;
		this.schedulingService = null;
		this.patternCache = new Map(); // Cache pattern analysis results
	}

	async initialize() {
		try {
			const userPrefs = await getUserPreferences(this.userId);
			const activeReminders = await getActiveReminders(this.userId);
			this.schedulingService = new SchedulingService(
				userPrefs?.scheduling_preferences,
				activeReminders,
				this.timezone
			);
			await schedulingHistory.initialize();
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

	async handleLaterToday(contactId, currentTime = DateTime.now()) {
		try {
			if (!this.schedulingService) await this.initialize();

			// Always use standard timing for "later today"
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

			await updateContactScheduling(contactId, {
				custom_next_date: availableTime,
				last_snooze_type: 'later_today',
				snooze_count: { increment: 1 },
				status: REMINDER_STATUS.SNOOZED,
			});

			await schedulingHistory.trackSnooze(
				contactId,
				currentTime,
				DateTime.fromJSDate(availableTime),
				'later_today'
			);

			return availableTime;
		} catch (error) {
			console.error('Error in handleLaterToday:', error);
			throw error;
		}
	}

	async handleTomorrow(contactId, currentTime = DateTime.now()) {
		try {
			if (!this.schedulingService) await this.initialize();

			// Get optimal time based on patterns
			const optimalTime = await this.findOptimalTime(contactId, currentTime, 'tomorrow');

			// If we have an optimal time, use it with tomorrow's date
			let proposedTime;
			if (optimalTime) {
				proposedTime = optimalTime.plus({ days: 1 }).toJSDate();
			} else {
				proposedTime = currentTime.plus({ days: 1 }).toJSDate();
			}

			const availableTime = await this.schedulingService.findAvailableTimeSlot(proposedTime, {
				id: contactId,
			});

			await updateContactScheduling(contactId, {
				custom_next_date: availableTime,
				last_snooze_type: 'tomorrow',
				snooze_count: { increment: 1 },
				status: REMINDER_STATUS.SNOOZED,
			});

			await schedulingHistory.trackSnooze(
				contactId,
				currentTime,
				DateTime.fromJSDate(availableTime),
				'tomorrow'
			);

			return availableTime;
		} catch (error) {
			console.error('Error in handleTomorrow:', error);
			throw error;
		}
	}

	async handleNextWeek(contactId, currentTime = DateTime.now()) {
		try {
			if (!this.schedulingService) await this.initialize();

			const optimalTime = await this.findOptimalTime(contactId, currentTime.plus({ weeks: 1 }), 'next_week');
			let proposedTime = optimalTime ? optimalTime.toJSDate() : currentTime.plus({ weeks: 1 }).toJSDate();

			const availableTime = await this.schedulingService.findAvailableTimeSlot(proposedTime, {
				id: contactId,
			});

			await updateContactScheduling(contactId, {
				custom_next_date: availableTime,
				last_snooze_type: 'next_week',
				snooze_count: { increment: 1 },
				status: REMINDER_STATUS.SNOOZED,
			});

			await schedulingHistory.trackSnooze(
				contactId,
				currentTime,
				DateTime.fromJSDate(availableTime),
				'next_week'
			);

			return availableTime;
		} catch (error) {
			console.error('Error in handleNextWeek:', error);
			throw error;
		}
	}

	async handleSkip(contactId, currentTime = DateTime.now()) {
		try {
			await updateContactScheduling(contactId, {
				custom_next_date: null,
				last_snooze_type: 'skip',
				status: REMINDER_STATUS.SKIPPED,
			});

			await schedulingHistory.trackSkip(contactId, currentTime);
			return true;
		} catch (error) {
			console.error('Error in handleSkip:', error);
			throw error;
		}
	}

	async handleSnooze(contactId, option, currentTime = DateTime.now()) {
		const snoozeOption = SNOOZE_OPTIONS.find((opt) => opt.id === option);
		if (!snoozeOption) throw new Error('Invalid snooze option');

		switch (option) {
			case 'later_today':
				return this.handleLaterToday(contactId, currentTime);
			case 'tomorrow':
				return this.handleTomorrow(contactId, currentTime);
			case 'next_week':
				return this.handleNextWeek(contactId, currentTime);
			case 'skip':
				return this.handleSkip(contactId, currentTime);
			default:
				throw new Error('Unsupported snooze option');
		}
	}

	clearPatternCache() {
		this.patternCache.clear();
	}
}

export const snoozeHandler = new SnoozeHandler();
