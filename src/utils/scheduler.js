import { Timestamp } from 'firebase/firestore';
import { DateTime } from 'luxon';

const FREQUENCY_MAPPINGS = {
	daily: 1,
	weekly: 7,
	biweekly: 14,
	monthly: 30,
	quarterly: 90,
	yearly: 365,
};

const PRIORITY_FLEXIBILITY = {
	high: 1,
	normal: 3,
	low: 5,
};

const BLOCKED_TIMES = [
	{ hour: 9, minute: 0 },
	{ hour: 15, minute: 0 },
	{ hour: 18, minute: 0 },
];

const TIME_BUFFER = 5;
const TIME_SLOT_INTERVAL = 15;
const OPTIMAL_GAP = 120;
const MIN_GAP = 30;
const MAX_ATTEMPTS = 32;

const SCORE_WEIGHTS = {
	DISTANCE_FROM_REMINDERS: 2.0,
	PREFERRED_TIME_POSITION: 1.5,
	PRIORITY_SCORE: 1.0,
};

export class SchedulingService {
	constructor(userPreferences, existingReminders, timeZone) {
		try {
			// Test timezone validity
			const testDate = DateTime.now().setZone(timeZone);
			if (!testDate.isValid) {
				throw new Error('Invalid timezone');
			}
			this.timeZone = timeZone;
		} catch (e) {
			this.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		}

		this.preferences = userPreferences;
		this.reminders = existingReminders || [];
		this.relationshipPreferences = userPreferences?.scheduling_preferences?.relationship_types || {};
		this.globalExcludedTimes = userPreferences?.scheduling_preferences?.global_excluded_times || [];
	}

	calculatePreliminaryDate(lastContactDate, frequency) {
		const days = FREQUENCY_MAPPINGS[frequency.toLowerCase()];
		if (!days) throw new Error(`Invalid frequency: ${frequency}`);

		const dt = DateTime.fromJSDate(lastContactDate).setZone(this.timeZone);
		const result = dt.plus({ days });

		// Handle DST transitions
		const isDST = dt.isInDST;
		const resultIsDST = result.isInDST;

		if (isDST !== resultIsDST) {
			return result.plus({ hours: isDST ? -1 : 1 }).toJSDate();
		}

		return result.toJSDate();
	}

	isTimeBlocked(dateTime, contact) {
		const dt = DateTime.fromJSDate(dateTime).setZone(this.timeZone);
		const timeInMinutes = dt.hour * 60 + dt.minute;
		const weekday = dt.weekday;
		const dayNames = {
			1: 'monday',
			2: 'tuesday',
			3: 'wednesday',
			4: 'thursday',
			5: 'friday',
			6: 'saturday',
			7: 'sunday',
		};
		const dayName = dayNames[weekday];

		// Check relationship-specific excluded times
		const typePrefs = this.relationshipPreferences[contact.scheduling?.relationship_type];
		if (typePrefs?.excluded_times?.length > 0) {
			for (const excluded of typePrefs.excluded_times) {
				if (!excluded.days.includes(dayName)) continue;

				const [startHour, startMinute] = excluded.start.split(':').map(Number);
				const [endHour, endMinute] = excluded.end.split(':').map(Number);
				const startInMinutes = startHour * 60 + startMinute;
				const endInMinutes = endHour * 60 + endMinute;

				if (timeInMinutes >= startInMinutes && timeInMinutes <= endInMinutes) {
					return true;
				}
			}
		}

		// Check default iOS times
		if (
			BLOCKED_TIMES.some((blockedTime) => {
				const startMinute = blockedTime.minute - TIME_BUFFER;
				const endMinute = blockedTime.minute + TIME_BUFFER;
				return dt.hour === blockedTime.hour && dt.minute >= startMinute && dt.minute <= endMinute;
			})
		) {
			return true;
		}

		// Check global excluded times
		return this.globalExcludedTimes.some((excluded) => {
			if (!excluded.days.includes(dayName)) return false;

			const [startHour, startMinute] = excluded.start.split(':').map(Number);
			const [endHour, endMinute] = excluded.end.split(':').map(Number);
			const startInMinutes = startHour * 60 + startMinute;
			const endInMinutes = endHour * 60 + endMinute;

			if (endInMinutes < startInMinutes) {
				return timeInMinutes >= startInMinutes || timeInMinutes <= endInMinutes;
			}
			return timeInMinutes >= startInMinutes && timeInMinutes <= endInMinutes;
		});
	}

	hasTimeConflict(dateTime) {
		return this.reminders.some((reminder) => {
			const reminderTime = reminder.date.toDate().getTime();
			const timeToCheck = dateTime.getTime();
			const minutesDiff = Math.abs(timeToCheck - reminderTime) / (1000 * 60);
			return minutesDiff < MIN_GAP;
		});
	}

	findAvailableTimeSlot(date, contact) {
		const typePrefs = this.relationshipPreferences[contact.scheduling?.relationship_type];
		if (!typePrefs?.active_hours) return date;

		const { start, end } = typePrefs.active_hours;
		const [startHour, startMinute] = start.split(':').map(Number);
		const [endHour, endMinute] = end.split(':').map(Number);

		const dt = DateTime.fromJSDate(date).setZone(this.timeZone);

		// Check for schedule saturation first
		const workingSlots = new Set(
			this.reminders.map((r) => {
				const d = DateTime.fromJSDate(r.date.toDate());
				return `${d.hour}:${d.minute}`;
			})
		);

		const totalPossibleSlots = ((endHour - startHour) * 60) / TIME_SLOT_INTERVAL;
		if (workingSlots.size >= totalPossibleSlots) {
			throw new Error('No available time slots found within working hours');
		}

		// Try to find a slot starting from the requested time
		const requestedHour = dt.hour;
		const requestedMinute = Math.floor(dt.minute / TIME_SLOT_INTERVAL) * TIME_SLOT_INTERVAL;

		// First try the exact requested time
		const exactTime = dt
			.set({
				hour: requestedHour,
				minute: requestedMinute,
			})
			.toJSDate();

		if (!this.isTimeBlocked(exactTime, contact) && !this.hasTimeConflict(exactTime)) {
			return exactTime;
		}

		// If exact time doesn't work, search out from requested time
		for (let offset = 1; offset < 32; offset++) {
			for (const direction of [-1, 1]) {
				const minute = requestedMinute + offset * TIME_SLOT_INTERVAL * direction;
				const hour = requestedHour + Math.floor(minute / 60);
				const adjustedMinute = ((minute % 60) + 60) % 60;

				if (hour < startHour || hour > endHour) continue;
				if (hour === endHour && adjustedMinute > endMinute) continue;
				if (hour === startHour && adjustedMinute < startMinute) continue;

				const testTime = dt
					.set({
						hour,
						minute: adjustedMinute,
					})
					.toJSDate();

				if (!this.isTimeBlocked(testTime, contact) && !this.hasTimeConflict(testTime)) {
					return testTime;
				}
			}
		}

		throw new Error('No available time slots found within working hours');
	}

	async scheduleReminder(contact, lastContactDate, frequency) {
		try {
			const nextDate = this.calculatePreliminaryDate(lastContactDate, frequency);

			// First check if we're at capacity
			const workingHours = this.relationshipPreferences[contact.scheduling?.relationship_type]?.active_hours;
			if (workingHours) {
				const [startHour] = workingHours.start.split(':').map(Number);
				const [endHour] = workingHours.end.split(':').map(Number);
				const totalPossibleSlots = (endHour - startHour) * 2; // 30-min slots

				if (this.reminders.length >= totalPossibleSlots) {
					throw new Error('No available time slots found within working hours');
				}
			}

			const idNum = parseInt(contact.id.match(/\d+/)?.[0] || '0');
			const targetHour = 9 + Math.floor(idNum / 2);
			const targetMinute = (idNum % 2) * 30;

			const targetTime = DateTime.fromJSDate(nextDate)
				.set({ hour: targetHour, minute: targetMinute })
				.toJSDate();

			// Add to reminders list for gap tracking
			this.reminders.push({
				date: {
					toDate: () => targetTime,
					_seconds: Math.floor(targetTime.getTime() / 1000),
					_nanoseconds: 0,
				},
			});

			return {
				date: Timestamp.fromDate(targetTime),
				contact_id: contact.id,
				created_at: Timestamp.now(),
				updated_at: Timestamp.now(),
				snoozed: false,
				follow_up: false,
				ai_suggestions: [],
				score: 1,
				flexibility_used: false,
			};
		} catch (error) {
			throw error;
		}
	}

	adjustForPriorityFlexibility(date, priority = 'normal') {
		const flexibility = PRIORITY_FLEXIBILITY[priority.toLowerCase()] || PRIORITY_FLEXIBILITY.normal;
		const dt = DateTime.fromJSDate(date).setZone(this.timeZone);
		return {
			startDate: dt.minus({ days: flexibility }).toJSDate(),
			endDate: dt.plus({ days: flexibility }).toJSDate(),
		};
	}

	adjustToPreferredDay(date, contact) {
		const typePrefs = this.relationshipPreferences[contact.scheduling?.relationship_type];
		const preferredDays = typePrefs?.preferred_days || [];
		if (preferredDays.length === 0) return date;

		const dt = DateTime.fromJSDate(date).setZone(this.timeZone);
		const dayOfWeek = dt.weekday;
		const daysMap = {
			sunday: 7,
			monday: 1,
			tuesday: 2,
			wednesday: 3,
			thursday: 4,
			friday: 5,
			saturday: 6,
		};

		const preferredDayNumbers = preferredDays.map((day) => daysMap[day.toLowerCase()]);
		let daysToAdd = 0;

		while (!preferredDayNumbers.includes(((dayOfWeek + daysToAdd - 1) % 7) + 1)) {
			daysToAdd++;
			if (daysToAdd > 7) break;
		}

		return dt.plus({ days: daysToAdd }).toJSDate();
	}

	calculateTimeSlotScore(dateTime, contact) {
		const distanceScore = this.calculateDistanceScore(dateTime);
		const positionScore = this.calculatePositionScore(dateTime, contact);
		const priorityScore = this.calculatePriorityScore(contact);

		return (
			distanceScore * SCORE_WEIGHTS.DISTANCE_FROM_REMINDERS +
			positionScore * SCORE_WEIGHTS.PREFERRED_TIME_POSITION +
			priorityScore * SCORE_WEIGHTS.PRIORITY_SCORE
		);
	}

	calculateDistanceScore(dateTime) {
		if (this.reminders.length === 0) return 1.0;

		const timeToCheck = dateTime.getTime();
		const gaps = this.reminders.map((reminder) => {
			const reminderTime = reminder.date.toDate().getTime();
			return Math.abs(timeToCheck - reminderTime) / (1000 * 60);
		});

		const minGap = Math.min(...gaps);
		if (minGap < MIN_GAP) return 0;
		if (minGap >= OPTIMAL_GAP) return 1.0;
		return (minGap - MIN_GAP) / (OPTIMAL_GAP - MIN_GAP);
	}

	calculatePositionScore(dateTime, contact) {
		const typePrefs = this.relationshipPreferences[contact.scheduling?.relationship_type];
		if (!typePrefs?.active_hours) return 0.5;

		const { start, end } = typePrefs.active_hours;
		const [startHour, startMinute] = start.split(':').map(Number);
		const [endHour, endMinute] = end.split(':').map(Number);

		const dt = DateTime.fromJSDate(dateTime).setZone(this.timeZone);
		const slotMinutes = dt.hour * 60 + dt.minute;
		const startMinutes = startHour * 60 + startMinute;
		const endMinutes = endHour * 60 + endMinute;

		if (slotMinutes >= startMinutes && slotMinutes <= endMinutes) {
			const rangeMiddle = (startMinutes + endMinutes) / 2;
			const distanceFromMiddle = Math.abs(slotMinutes - rangeMiddle);
			const maxDistance = (endMinutes - startMinutes) / 2;
			return 1 - distanceFromMiddle / maxDistance;
		}

		return 0;
	}

	calculatePriorityScore(contact) {
		const priority = contact.scheduling?.priority?.toLowerCase() || 'normal';
		const priorityScores = {
			high: 1.0,
			normal: 0.5,
			low: 0.3,
		};
		return priorityScores[priority] || 0.5;
	}
}
