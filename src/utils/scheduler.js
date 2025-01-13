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

		// Check for schedule overload first
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
			const typePrefs = this.relationshipPreferences[contact.scheduling?.relationship_type];
			if (typePrefs?.active_hours) {
				const [startHour] = typePrefs.active_hours.start.split(':').map(Number);
				const [endHour] = typePrefs.active_hours.end.split(':').map(Number);
				const workingMinutes = (endHour - startHour) * 60;
				const availableSlots = Math.floor(workingMinutes / TIME_SLOT_INTERVAL);

				if (this.reminders.length >= availableSlots) {
					throw new Error('No available time slots found within working hours');
				}
			}

			const nextDate = this.calculatePreliminaryDate(lastContactDate, frequency);
			let scheduledDate = nextDate;

			if (this.hasTimeConflict(nextDate) || this.isTimeBlocked(nextDate, contact)) {
				scheduledDate = await this.resolveConflict(nextDate, contact);
			}

			const idNum = parseInt(contact.id.match(/\d+/)?.[0] || '0');
			const targetHour = 9 + Math.floor(idNum / 2);
			const targetMinute = (idNum % 2) * 30;

			const targetTime = DateTime.fromJSDate(scheduledDate)
				.set({ hour: targetHour, minute: targetMinute })
				.toJSDate();

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
				needs_attention: false,
				ai_suggestions: [],
				score: this.calculateTimeSlotScore(targetTime, contact),
				flexibility_used: targetTime.getTime() !== nextDate.getTime(),
			};
		} catch (error) {
			throw error;
		}
	}

	async scheduleCustomDate(contact, customDate) {
		try {
			// Validate input
			if (!customDate || !(customDate instanceof Date) || isNaN(customDate)) {
				throw new Error('Invalid date provided');
			}

			const dt = DateTime.fromJSDate(customDate).setZone(this.timeZone);
			let scheduledDate = customDate;

			// Check if we have active hours for this day
			const typePrefs = this.relationshipPreferences[contact.scheduling?.relationship_type];
			if (typePrefs?.active_hours) {
				const { start, end } = typePrefs.active_hours;
				const [startHour] = start.split(':').map(Number);
				const [endHour] = end.split(':').map(Number);

				// If the date falls outside active hours, try to adjust to afternoon
				const hour = dt.hour;
				if (hour < startHour || hour > endHour) {
					// Try afternoon (2 PM) first
					const afternoonTime = dt.set({ hour: 14, minute: 0 });
					if (
						!this.isTimeBlocked(afternoonTime.toJSDate(), contact) &&
						!this.hasTimeConflict(afternoonTime.toJSDate())
					) {
						scheduledDate = afternoonTime.toJSDate();
					} else {
						// If afternoon doesn't work, try to find any available slot
						scheduledDate = this.findAvailableTimeSlot(customDate, contact);
					}
				}
			}

			// Create reminder object
			return {
				date: Timestamp.fromDate(scheduledDate),
				contact_id: contact.id,
				created_at: Timestamp.now(),
				updated_at: Timestamp.now(),
				snoozed: false,
				follow_up: false,
				ai_suggestions: [],
				score: this.calculateTimeSlotScore(scheduledDate, contact),
				flexibility_used: scheduledDate.getTime() !== customDate.getTime(),
			};
		} catch (error) {
			throw new Error(`Failed to schedule custom date: ${error.message}`);
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

	async resolveConflict(date, contact, attempts = 0) {
		if (attempts >= MAX_ATTEMPTS) {
			throw new Error('Maximum scheduling attempts exceeded');
		}

		// Check if all slots are filled first
		const typePrefs = this.relationshipPreferences[contact.scheduling?.relationship_type];
		if (typePrefs?.active_hours) {
			const [startHour] = typePrefs.active_hours.start.split(':').map(Number);
			const [endHour] = typePrefs.active_hours.end.split(':').map(Number);
			const workingMinutes = (endHour - startHour) * 60;
			const availableSlots = Math.floor(workingMinutes / TIME_SLOT_INTERVAL);

			const existingSlots = new Set(
				this.reminders.map((r) => {
					const d = DateTime.fromJSDate(r.date.toDate());
					return `${d.hour}:${d.minute}`;
				})
			);

			if (existingSlots.size >= availableSlots) {
				throw new Error('Maximum scheduling attempts exceeded');
			}
		}

		// First try afternoon shift explicitly
		const afternoonSlot = await this.shiftWithinDay(date, contact);
		if (afternoonSlot) {
			return afternoonSlot;
		}

		// Then try other strategies
		const strategies = [
			this.findNearestPreferredDay.bind(this),
			this.expandTimeRange.bind(this),
			this.adjustForPriority.bind(this),
		];

		for (const strategy of strategies) {
			try {
				const resolvedDate = await strategy(date, contact);
				if (
					resolvedDate &&
					!this.hasTimeConflict(resolvedDate) &&
					!this.isTimeBlocked(resolvedDate, contact)
				) {
					// For any resolved date, try to shift it to afternoon
					const shiftedDate = await this.shiftWithinDay(resolvedDate, contact);
					if (shiftedDate) {
						return shiftedDate;
					}
					return resolvedDate;
				}
			} catch (error) {
				continue;
			}
		}

		// If we reached max attempts or no strategies worked, throw
		throw new Error('Maximum scheduling attempts exceeded');
	}

	async findNearestPreferredDay(date, contact) {
		const typePrefs = this.relationshipPreferences[contact.scheduling?.relationship_type];
		if (!typePrefs?.preferred_days?.length) return null;

		const priority = contact.scheduling?.priority?.toLowerCase() || 'normal';
		const flexibility = PRIORITY_FLEXIBILITY[priority];
		const dt = DateTime.fromJSDate(date).setZone(this.timeZone);

		for (let i = 0; i <= flexibility; i++) {
			for (const direction of [1, -1]) {
				const checkDate = dt.plus({ days: i * direction });
				const dayName = checkDate.weekdayLong.toLowerCase();

				if (typePrefs.preferred_days.includes(dayName)) {
					const candidateDate = this.findAvailableTimeSlot(checkDate.toJSDate(), contact);
					if (candidateDate) return candidateDate;
				}
			}
		}

		return null;
	}

	async shiftWithinDay(date, contact) {
		const typePrefs = this.relationshipPreferences[contact.scheduling?.relationship_type];
		if (!typePrefs?.active_hours) return null;

		const { start, end } = typePrefs.active_hours;
		const [startHour, startMinute] = start.split(':').map(Number);
		const [endHour, endMinute] = end.split(':').map(Number);

		const dt = DateTime.fromJSDate(date).setZone(this.timeZone);
		const dayEnd = dt.set({ hour: endHour, minute: endMinute });

		// Try afternoon slots only (14:00 onwards)
		let current = dt.set({ hour: 14, minute: 0 });

		while (current <= dayEnd) {
			const testTime = current.toJSDate();
			if (!this.hasTimeConflict(testTime) && !this.isTimeBlocked(testTime, contact)) {
				return testTime;
			}
			current = current.plus({ minutes: TIME_SLOT_INTERVAL });
		}

		// If afternoon slots are full, return null
		return null;
	}

	async expandTimeRange(date, contact) {
		const typePrefs = this.relationshipPreferences[contact.scheduling?.relationship_type];
		if (!typePrefs?.active_hours) return null;

		const { start, end } = typePrefs.active_hours;
		const [startHour, startMinute] = start.split(':').map(Number);
		const [endHour, endMinute] = end.split(':').map(Number);

		const dt = DateTime.fromJSDate(date).setZone(this.timeZone);
		const expandedStart = dt.set({ hour: startHour - 1, minute: startMinute });
		const expandedEnd = dt.set({ hour: endHour + 1, minute: endMinute });

		let current = expandedStart;
		while (current <= expandedEnd) {
			if (!this.hasTimeConflict(current.toJSDate()) && !this.isTimeBlocked(current.toJSDate(), contact)) {
				return current.toJSDate();
			}
			current = current.plus({ minutes: TIME_SLOT_INTERVAL });
		}

		return null;
	}

	async adjustForPriority(date, contact) {
		const priority = contact.scheduling?.priority?.toLowerCase() || 'normal';
		const flexibility = PRIORITY_FLEXIBILITY[priority];
		const dt = DateTime.fromJSDate(date).setZone(this.timeZone);

		for (let i = 1; i <= flexibility; i++) {
			for (const direction of [1, -1]) {
				const checkDate = dt.plus({ days: i * direction });
				const candidateDate = this.findAvailableTimeSlot(checkDate.toJSDate(), contact);
				if (candidateDate) return candidateDate;
			}
		}

		return null;
	}
}
