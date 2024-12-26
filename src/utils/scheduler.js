import { Timestamp } from 'firebase/firestore';

// Standard frequency mappings in days
const FREQUENCY_MAPPINGS = {
	daily: 1,
	weekly: 7,
	biweekly: 14,
	monthly: 30,
	bimonthly: 60,
	quarterly: 90,
	semiannually: 180,
	yearly: 365,
};

// Default iOS reminder times to avoid (in 24h format)
const BLOCKED_TIMES = [
	{ hour: 9, minute: 0 }, // 9:00 AM
	{ hour: 15, minute: 0 }, // 3:00 PM
	{ hour: 18, minute: 0 }, // 6:00 PM
];

const TIME_BUFFER = 5; // 5 minutes before and after blocked times

export class SchedulingService {
	constructor(userPreferences, existingReminders, timeZone) {
		this.preferences = userPreferences;
		this.reminders = existingReminders;
		this.timeZone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
	}

	// Step 1: Calculate preliminary next contact date
	calculatePreliminaryDate(lastContactDate, frequency) {
		const days = FREQUENCY_MAPPINGS[frequency.toLowerCase()];
		if (!days) throw new Error(`Invalid frequency: ${frequency}`);

		const nextDate = new Date(lastContactDate);
		nextDate.setDate(nextDate.getDate() + days);
		return nextDate;
	}

	// Step 2: Adjust to preferred day
	adjustToPreferredDay(date) {
		const dayOfWeek = date.getDay();
		const preferredDays = this.preferences.preferredDays || [];

		if (preferredDays.length === 0) return date;

		// Convert preferred days to numbers (0-6, where 0 is Sunday)
		const preferredDayNumbers = preferredDays.map((day) => {
			const daysMap = {
				sunday: 0,
				monday: 1,
				tuesday: 2,
				wednesday: 3,
				thursday: 4,
				friday: 5,
				saturday: 6,
			};
			return daysMap[day.toLowerCase()];
		});

		// Find the next preferred day
		let daysToAdd = 0;
		while (!preferredDayNumbers.includes((dayOfWeek + daysToAdd) % 7)) {
			daysToAdd++;
			if (daysToAdd > 7) break; // Prevent infinite loop
		}

		const adjustedDate = new Date(date);
		adjustedDate.setDate(date.getDate() + daysToAdd);
		return adjustedDate;
	}

	// Step 3: Check for conflicts
	hasTimeConflict(dateTime) {
		const minGap = 30; // 30 minutes minimum gap between reminders
		const timeToCheck = dateTime.getTime();

		return this.reminders.some((reminder) => {
			const reminderTime = reminder.date.toDate().getTime();
			const timeDiff = Math.abs(timeToCheck - reminderTime);
			const minutesDiff = timeDiff / (1000 * 60);
			return minutesDiff < minGap;
		});
	}

	// Step 4: Check if time is blocked
	isTimeBlocked(dateTime) {
		const hour = dateTime.getHours();
		const minute = dateTime.getMinutes();

		// Check default iOS times
		return BLOCKED_TIMES.some((blockedTime) => {
			const startMinute = blockedTime.minute - TIME_BUFFER;
			const endMinute = blockedTime.minute + TIME_BUFFER;

			if (hour === blockedTime.hour) {
				return minute >= startMinute && minute <= endMinute;
			}
			return false;
		});
	}

	// Step 5: Find available time slot within preferred range
	findAvailableTimeSlot(date) {
		const { preferredTimeRanges } = this.preferences;
		if (!preferredTimeRanges || preferredTimeRanges.length === 0) {
			return date; // Return original date if no preferences
		}

		for (const range of preferredTimeRanges) {
			const startHour = parseInt(range.start.split(':')[0]);
			const startMinute = parseInt(range.start.split(':')[1]);
			const endHour = parseInt(range.end.split(':')[0]);
			const endMinute = parseInt(range.end.split(':')[1]);

			// Try each hour in the range
			for (let hour = startHour; hour <= endHour; hour++) {
				// Try every 15 minutes
				for (let minute = 0; minute < 60; minute += 15) {
					// Skip if outside the range
					if (hour === endHour && minute > endMinute) continue;
					if (hour === startHour && minute < startMinute) continue;

					const testDate = new Date(date);
					testDate.setHours(hour, minute, 0, 0);

					if (!this.isTimeBlocked(testDate) && !this.hasTimeConflict(testDate)) {
						return testDate;
					}
				}
			}
		}

		return null; // No available slot found
	}

	// Main scheduling function
	async scheduleReminder(contact, lastContactDate, frequency) {
		try {
			// Step 1: Calculate preliminary date
			let nextDate = this.calculatePreliminaryDate(lastContactDate, frequency);

			// Step 2: Adjust to preferred day
			nextDate = this.adjustToPreferredDay(nextDate);

			// Step 3 & 4 & 5: Find available time slot
			const availableSlot = this.findAvailableTimeSlot(nextDate);

			if (!availableSlot) {
				// Handle no available slot case
				throw new Error('No available time slots found');
			}

			return {
				date: Timestamp.fromDate(availableSlot),
				contact_id: contact.id,
				created_at: Timestamp.now(),
				updated_at: Timestamp.now(),
				snoozed: false,
				follow_up: false,
				ai_suggestions: [], // To be filled by AI module
			};
		} catch (error) {
			console.error('Scheduling error:', error);
			throw error;
		}
	}
}
