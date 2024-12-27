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

// Score based time slot weighting
const SCORE_WEIGHTS = {
	DISTANCE_FROM_REMINDERS: 2.0, // Higher weight for spacing between reminders
	PREFERRED_TIME_POSITION: 1.5, // Medium weight for optimal time of day
	CONTACT_PRIORITY: 1.0, // Base weight for contact importance
};

const TIME_SLOT_INTERVAL = 15; // Minutes between each potential slot
const OPTIMAL_GAP = 120; // Optimal minutes between reminders (2 hours)

export class SchedulingService {
	constructor(userPreferences, existingReminders, timeZone) {
		this.preferences = userPreferences;
		this.reminders = existingReminders;
		this.timeZone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
	}

	calculatePreliminaryDate(lastContactDate, frequency) {
		const days = FREQUENCY_MAPPINGS[frequency.toLowerCase()];
		if (!days) throw new Error(`Invalid frequency: ${frequency}`);

		const nextDate = new Date(lastContactDate);
		nextDate.setDate(nextDate.getDate() + days);
		return nextDate;
	}

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

	calculateTimeSlotScore(dateTime, contact) {
		let score = 0;

		const distanceScore = this.calculateDistanceScore(dateTime);
		score += distanceScore * SCORE_WEIGHTS.DISTANCE_FROM_REMINDERS;

		const positionScore = this.calculatePositionScore(dateTime);
		score += positionScore * SCORE_WEIGHTS.PREFERRED_TIME_POSITION;

		const priorityScore = this.calculatePriorityScore(contact);
		score += priorityScore * SCORE_WEIGHTS.CONTACT_PRIORITY;

		return score;
	}

	calculateDistanceScore(dateTime) {
		if (this.reminders.length === 0) return 1.0;

		const timeToCheck = dateTime.getTime();
		const gaps = this.reminders.map((reminder) => {
			const reminderTime = reminder.date.toDate().getTime();
			return Math.abs(timeToCheck - reminderTime) / (1000 * 60); // Convert to minutes
		});

		const minGap = Math.min(...gaps);

		// Score based on gap to nearest reminder
		if (minGap < 30) return 0; // Less than minimum gap
		if (minGap >= OPTIMAL_GAP) return 1.0; // Optimal or better spacing

		// Linear score between minimum gap (30 min) and optimal gap (120 min)
		return (minGap - 30) / (OPTIMAL_GAP - 30);
	}

	calculatePositionScore(dateTime) {
		const { preferredTimeRanges } = this.preferences;
		if (!preferredTimeRanges || preferredTimeRanges.length === 0) return 0.5;

		for (const range of preferredTimeRanges) {
			const [startHour, startMinute] = range.start.split(':').map(Number);
			const [endHour, endMinute] = range.end.split(':').map(Number);

			const startMinutes = startHour * 60 + startMinute;
			const endMinutes = endHour * 60 + endMinute;
			const slotMinutes = dateTime.getHours() * 60 + dateTime.getMinutes();

			if (slotMinutes >= startMinutes && slotMinutes <= endMinutes) {
				// Score highest in the middle of the preferred range
				const rangeMiddle = (startMinutes + endMinutes) / 2;
				const distanceFromMiddle = Math.abs(slotMinutes - rangeMiddle);
				const maxDistance = (endMinutes - startMinutes) / 2;

				return 1 - distanceFromMiddle / maxDistance;
			}
		}

		return 0; // Outside all preferred ranges
	}

	calculatePriorityScore(contact) {
		// Default priority if not specified
		if (!contact.scheduling?.priority) return 0.5;

		// Convert priority string to score
		const priorityScores = {
			high: 1.0,
			normal: 0.5,
			low: 0.3,
		};

		return priorityScores[contact.scheduling.priority.toLowerCase()] || 0.5;
	}

	findAvailableTimeSlot(date, contact) {
		const { preferredTimeRanges } = this.preferences;
		if (!preferredTimeRanges || preferredTimeRanges.length === 0) {
			return date;
		}

		let bestSlot = null;
		let bestScore = -1;

		for (const range of preferredTimeRanges) {
			const [startHour, startMinute] = range.start.split(':').map(Number);
			const [endHour, endMinute] = range.end.split(':').map(Number);

			// Try each time slot in the range
			for (let hour = startHour; hour <= endHour; hour++) {
				for (let minute = 0; minute < 60; minute += TIME_SLOT_INTERVAL) {
					// Skip if outside the range
					if (hour === endHour && minute > endMinute) continue;
					if (hour === startHour && minute < startMinute) continue;

					const testDate = new Date(date);
					testDate.setHours(hour, minute, 0, 0);

					// Skip blocked or conflicting times
					if (this.isTimeBlocked(testDate) || this.hasTimeConflict(testDate)) {
						continue;
					}

					// Calculate score for this slot
					const score = this.calculateTimeSlotScore(testDate, contact);

					// Update best slot if this score is higher
					if (score > bestScore) {
						bestScore = score;
						bestSlot = testDate;
					}
				}
			}
		}

		return bestSlot;
	}

	async scheduleReminder(contact, lastContactDate, frequency) {
		try {
			let nextDate = this.calculatePreliminaryDate(lastContactDate, frequency);
			nextDate = this.adjustToPreferredDay(nextDate);

			const availableSlot = this.findAvailableTimeSlot(nextDate, contact);

			if (!availableSlot) {
				throw new Error('No available time slots found');
			}

			return {
				date: Timestamp.fromDate(availableSlot),
				contact_id: contact.id,
				created_at: Timestamp.now(),
				updated_at: Timestamp.now(),
				snoozed: false,
				follow_up: false,
				ai_suggestions: [],
				score: this.calculateTimeSlotScore(availableSlot, contact), // Optional: store the score
			};
		} catch (error) {
			console.error('Scheduling error:', error);
			throw error;
		}
	}
}
