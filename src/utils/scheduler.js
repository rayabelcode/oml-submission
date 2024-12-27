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
	DISTANCE_FROM_REMINDERS: 2.0,
	PREFERRED_TIME_POSITION: 1.5,
	CONTACT_PRIORITY: 1.0,
};

const TIME_SLOT_INTERVAL = 15; // Minutes between each potential slot
const OPTIMAL_GAP = 120; // Optimal minutes between reminders (2 hours)

export class SchedulingService {
	constructor(userPreferences, existingReminders, timeZone) {
		this.preferences = userPreferences;
		this.reminders = existingReminders;
		this.timeZone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
		this.relationshipPreferences = userPreferences?.scheduling_preferences?.relationship_types || {};
		this.globalExcludedTimes = userPreferences?.scheduling_preferences?.global_excluded_times || [];
	}

	calculatePreliminaryDate(lastContactDate, frequency) {
		const days = FREQUENCY_MAPPINGS[frequency.toLowerCase()];
		if (!days) throw new Error(`Invalid frequency: ${frequency}`);

		const nextDate = new Date(lastContactDate);
		nextDate.setDate(nextDate.getDate() + days);
		return nextDate;
	}

	adjustToPreferredDay(date, contact) {
		const typePrefs = this.relationshipPreferences[contact.relationship_type];
		const preferredDays = typePrefs?.preferred_days || [];

		if (preferredDays.length === 0) return date;

		const dayOfWeek = date.getDay();
		const daysMap = {
			sunday: 0,
			monday: 1,
			tuesday: 2,
			wednesday: 3,
			thursday: 4,
			friday: 5,
			saturday: 6,
		};

		const preferredDayNumbers = preferredDays.map((day) => daysMap[day.toLowerCase()]);

		let daysToAdd = 0;
		while (!preferredDayNumbers.includes((dayOfWeek + daysToAdd) % 7)) {
			daysToAdd++;
			if (daysToAdd > 7) break;
		}

		const adjustedDate = new Date(date);
		adjustedDate.setDate(date.getDate() + daysToAdd);
		return adjustedDate;
	}

	hasTimeConflict(dateTime) {
		const minGap = 30;
		const timeToCheck = dateTime.getTime();

		return this.reminders.some((reminder) => {
			const reminderTime = reminder.date.toDate().getTime();
			const timeDiff = Math.abs(timeToCheck - reminderTime);
			const minutesDiff = timeDiff / (1000 * 60);
			return minutesDiff < minGap;
		});
	}

	isTimeBlocked(dateTime, contact) {
		const hour = dateTime.getHours();
		const minute = dateTime.getMinutes();
		const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
			dateTime.getDay()
		];

		// Check default iOS times
		if (
			BLOCKED_TIMES.some((blockedTime) => {
				const startMinute = blockedTime.minute - TIME_BUFFER;
				const endMinute = blockedTime.minute + TIME_BUFFER;
				return hour === blockedTime.hour && minute >= startMinute && minute <= endMinute;
			})
		)
			return true;

		// Check global excluded times
		if (
			this.globalExcludedTimes.some((excluded) => {
				if (!excluded.days.includes(dayName)) return false;
				const [startHour, startMinute] = excluded.start.split(':').map(Number);
				const [endHour, endMinute] = excluded.end.split(':').map(Number);
				const timeInMinutes = hour * 60 + minute;
				const startInMinutes = startHour * 60 + startMinute;
				const endInMinutes = endHour * 60 + endMinute;
				return timeInMinutes >= startInMinutes && timeInMinutes <= endInMinutes;
			})
		)
			return true;

		// Check relationship-specific excluded times
		const typePrefs = this.relationshipPreferences[contact.relationship_type];
		return (
			typePrefs?.excluded_times?.some((excluded) => {
				if (!excluded.days.includes(dayName)) return false;
				const [startHour, startMinute] = excluded.start.split(':').map(Number);
				const [endHour, endMinute] = excluded.end.split(':').map(Number);
				const timeInMinutes = hour * 60 + minute;
				const startInMinutes = startHour * 60 + startMinute;
				const endInMinutes = endHour * 60 + endMinute;
				return timeInMinutes >= startInMinutes && timeInMinutes <= endInMinutes;
			}) || false
		);
	}

	calculateTimeSlotScore(dateTime, contact) {
		let score = 0;

		const distanceScore = this.calculateDistanceScore(dateTime);
		score += distanceScore * SCORE_WEIGHTS.DISTANCE_FROM_REMINDERS;

		const positionScore = this.calculatePositionScore(dateTime, contact);
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
			return Math.abs(timeToCheck - reminderTime) / (1000 * 60);
		});

		const minGap = Math.min(...gaps);

		if (minGap < 30) return 0;
		if (minGap >= OPTIMAL_GAP) return 1.0;

		return (minGap - 30) / (OPTIMAL_GAP - 30);
	}

	calculatePositionScore(dateTime, contact) {
		const typePrefs = this.relationshipPreferences[contact.relationship_type];
		if (!typePrefs?.active_hours) return 0.5;

		const { start, end } = typePrefs.active_hours;
		const [startHour, startMinute] = start.split(':').map(Number);
		const [endHour, endMinute] = end.split(':').map(Number);

		const startMinutes = startHour * 60 + startMinute;
		const endMinutes = endHour * 60 + endMinute;
		const slotMinutes = dateTime.getHours() * 60 + dateTime.getMinutes();

		if (slotMinutes >= startMinutes && slotMinutes <= endMinutes) {
			const rangeMiddle = (startMinutes + endMinutes) / 2;
			const distanceFromMiddle = Math.abs(slotMinutes - rangeMiddle);
			const maxDistance = (endMinutes - startMinutes) / 2;
			return 1 - distanceFromMiddle / maxDistance;
		}

		return 0;
	}

	calculatePriorityScore(contact) {
		if (!contact.scheduling?.priority) return 0.5;

		const priorityScores = {
			high: 1.0,
			normal: 0.5,
			low: 0.3,
		};

		return priorityScores[contact.scheduling.priority.toLowerCase()] || 0.5;
	}

	findAvailableTimeSlot(date, contact) {
		const typePrefs = this.relationshipPreferences[contact.relationship_type];
		if (!typePrefs?.active_hours) return date;

		const { start, end } = typePrefs.active_hours;
		const [startHour, startMinute] = start.split(':').map(Number);
		const [endHour, endMinute] = end.split(':').map(Number);

		let bestSlot = null;
		let bestScore = -1;

		for (let hour = startHour; hour <= endHour; hour++) {
			for (let minute = 0; minute < 60; minute += TIME_SLOT_INTERVAL) {
				if (hour === endHour && minute > endMinute) continue;
				if (hour === startHour && minute < startMinute) continue;

				const testDate = new Date(date);
				testDate.setHours(hour, minute, 0, 0);

				if (this.isTimeBlocked(testDate, contact) || this.hasTimeConflict(testDate)) {
					continue;
				}

				const score = this.calculateTimeSlotScore(testDate, contact);
				if (score > bestScore) {
					bestScore = score;
					bestSlot = testDate;
				}
			}
		}

		return bestSlot || date;
	}

	async scheduleReminder(contact, lastContactDate, frequency) {
		try {
			let nextDate = this.calculatePreliminaryDate(lastContactDate, frequency);
			nextDate = this.adjustToPreferredDay(nextDate, contact);

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
				score: this.calculateTimeSlotScore(availableSlot, contact),
			};
		} catch (error) {
			console.error('Scheduling error:', error);
			throw error;
		}
	}
}
