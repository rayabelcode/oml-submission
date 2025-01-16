import { DateTime } from 'luxon';
import { REMINDER_STATUS, SNOOZE_OPTIONS, MAX_SNOOZE_ATTEMPTS } from '../../constants/notificationConstants';
import { SchedulingService } from './scheduler';
import { updateContactScheduling, getUserPreferences, getActiveReminders } from './firestore';

export class SnoozeHandler {
	constructor(userId, timezone) {
		this.userId = userId;
		this.timezone = timezone;
		this.schedulingService = null;
	}

	async initialize() {
		const userPrefs = await getUserPreferences(this.userId);
		const activeReminders = await getActiveReminders(this.userId);
		this.schedulingService = new SchedulingService(
			userPrefs?.scheduling_preferences,
			activeReminders,
			this.timezone
		);
	}

	async handleLaterToday(contactId, currentTime = DateTime.now()) {
		try {
			if (!this.schedulingService) await this.initialize();

			const hour = currentTime.hour;
			let minMinutes, maxMinutes;

			// Adjust delay range based on time of day (including after midnight)
			if (hour >= 0 && hour < 4) {
				// Midnight to 4 AM
				minMinutes = 20;
				maxMinutes = 40;
			} else if (hour >= 21 || hour < 0) {
				// After 9 PM
				minMinutes = 20;
				maxMinutes = 40;
			} else if (hour >= 19) {
				// After 7 PM
				minMinutes = 50;
				maxMinutes = 80;
			} else if (hour >= 17) {
				// After 5 PM
				minMinutes = 120;
				maxMinutes = 150;
			} else {
				minMinutes = 150;
				maxMinutes = 210;
			}

			// Generate random minutes within range
			const minutesToAdd = Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
			const proposedTime = currentTime.plus({ minutes: minutesToAdd }).toJSDate();

			// Find available slot that respects gaps
			const availableTime = await this.schedulingService.findAvailableTimeSlot(proposedTime, {
				id: contactId,
			});

			await updateContactScheduling(contactId, {
				custom_next_date: availableTime,
				last_snooze_type: 'later_today',
				snooze_count: { increment: 1 },
				status: REMINDER_STATUS.SNOOZED,
			});

			return availableTime;
		} catch (error) {
			console.error('Error in handleLaterToday:', error);
			throw error;
		}
	}

	async handleTomorrow(contactId, currentTime = DateTime.now()) {
		try {
			if (!this.schedulingService) await this.initialize();

			// Same time tomorrow
			let proposedTime = currentTime.plus({ days: 1 }).toJSDate();

			// Find available slot that respects gaps
			const availableTime = await this.schedulingService.findAvailableTimeSlot(proposedTime, {
				id: contactId,
			});

			await updateContactScheduling(contactId, {
				custom_next_date: availableTime,
				last_snooze_type: 'tomorrow',
				snooze_count: { increment: 1 },
				status: REMINDER_STATUS.SNOOZED,
			});

			return availableTime;
		} catch (error) {
			console.error('Error in handleTomorrow:', error);
			throw error;
		}
	}

	async handleNextWeek(contactId, currentTime = DateTime.now()) {
		try {
			if (!this.schedulingService) await this.initialize();

			// Same time next week
			let proposedTime = currentTime.plus({ weeks: 1 }).toJSDate();

			// Find available slot that respects gaps
			const availableTime = await this.schedulingService.findAvailableTimeSlot(proposedTime, {
				id: contactId,
			});

			await updateContactScheduling(contactId, {
				custom_next_date: availableTime,
				last_snooze_type: 'next_week',
				snooze_count: { increment: 1 },
				status: REMINDER_STATUS.SNOOZED,
			});

			return availableTime;
		} catch (error) {
			console.error('Error in handleNextWeek:', error);
			throw error;
		}
	}

	async handleSkip(contactId) {
		try {
			await updateContactScheduling(contactId, {
				custom_next_date: null,
				last_snooze_type: 'skip',
				status: REMINDER_STATUS.SKIPPED,
			});

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
				return this.handleSkip(contactId);
			default:
				throw new Error('Unsupported snooze option');
		}
	}
}

// Export a singleton instance
export const snoozeHandler = new SnoozeHandler();
