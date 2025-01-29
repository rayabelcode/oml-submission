import { Timestamp } from 'firebase/firestore';
import { DateTime } from 'luxon';
import { scheduleLocalNotificationWithPush } from './../notifications/pushNotification';
// Recurring reminder configurations
import { schedulingHistory } from './schedulingHistory';
import {
	RECURRENCE_METADATA,
	MAX_AGE_DAYS,
	FREQUENCY_MAPPINGS,
	PRIORITY_FLEXIBILITY,
	BLOCKED_TIMES,
	TIME_BUFFER,
	TIME_SLOT_INTERVAL,
	MAX_ATTEMPTS,
	SCORE_WEIGHTS,
} from './schedulerConstants';

export class SchedulingService {
	constructor(userPreferences, existingReminders, timeZone) {
		try {
			const testDate = DateTime.now().setZone(timeZone);
			if (!testDate.isValid) {
				throw new Error('Invalid timezone');
			}
			this.timeZone = timeZone;
		} catch (e) {
			this.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		}

		this.userPreferences = userPreferences;
		this.reminders = existingReminders || [];
		this.globalExcludedTimes = userPreferences?.global_excluded_times || [];
	}

	getPreferencesForContact(contact) {
		const defaultPrefs = {
			active_hours: { start: '09:00', end: '17:00' },
			preferred_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
			excluded_times: [],
		};

		// If contact has custom schedule, use their preferences
		if (contact?.scheduling?.custom_schedule) {
			return contact.scheduling.custom_preferences;
		}

		// Otherwise use user preferences based on relationship type
		const relationshipType = contact?.scheduling?.relationship_type;
		if (relationshipType && this.userPreferences?.relationship_types?.[relationshipType]) {
			return this.userPreferences.relationship_types[relationshipType];
		}

		return defaultPrefs;
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

		// Get preferences for this contact
		const preferences = this.getPreferencesForContact(contact);

		// Check excluded times
		if (preferences?.excluded_times?.length > 0) {
			for (const excluded of preferences.excluded_times) {
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
		const minGap = this.userPreferences?.scheduling_preferences?.minimumGapMinutes || 20;
		const optimalGap = this.userPreferences?.scheduling_preferences?.optimalGapMinutes || 1440;

		return this.reminders.some((reminder) => {
			const reminderTime = reminder.scheduledTime.toDate().getTime();
			const timeToCheck = dateTime.getTime();
			const minutesDiff = Math.floor(Math.abs(timeToCheck - reminderTime) / (1000 * 60));

			// Always enforce the minimum gap
			return minutesDiff < minGap;
		});
	}

	findAvailableTimeSlot(date, contact) {
		const preferences = this.getPreferencesForContact(contact);
		if (!preferences?.active_hours) return date;

		const { start, end } = preferences.active_hours;
		const [startHour, startMinute] = start.split(':').map(Number);
		const [endHour, endMinute] = end.split(':').map(Number);

		const dt = DateTime.fromJSDate(date).setZone(this.timeZone);

		// Get all reminders for the current day
		const dayStart = dt.startOf('day');
		const dayEnd = dt.endOf('day');
		const dayReminders = this.reminders.filter((r) => {
			const reminderDate = DateTime.fromJSDate(r.scheduledTime.toDate());
			return reminderDate >= dayStart && reminderDate <= dayEnd;
		});

		const workingSlots = new Set(
			dayReminders.map((r) => {
				const d = DateTime.fromJSDate(r.scheduledTime.toDate());
				return `${d.hour}:${d.minute}`;
			})
		);

		const totalPossibleSlots = ((endHour - startHour) * 60) / TIME_SLOT_INTERVAL;

		// Only check current day's slots
		if (workingSlots.size >= totalPossibleSlots) {
			// Try next day instead of throwing error
			return this.findAvailableTimeSlot(
				dt.plus({ days: 1 }).set({ hour: startHour, minute: 0 }).toJSDate(),
				contact
			);
		}

		const requestedHour = dt.hour;
		const requestedMinute = Math.floor(dt.minute / TIME_SLOT_INTERVAL) * TIME_SLOT_INTERVAL;

		const exactTime = dt
			.set({
				hour: requestedHour,
				minute: requestedMinute,
			})
			.toJSDate();

		if (!this.isTimeBlocked(exactTime, contact) && !this.hasTimeConflict(exactTime)) {
			return exactTime;
		}

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

				if (!this.isTimeBlocked(testTime, contact) && !this.hasTimeConflict(testTime, contact)) {
					return testTime;
				}
			}
		}

		throw new Error('No available time slots found within working hours');
	}

	async scheduleReminder(contact, lastContactDate, frequency) {
		try {
			const preferences = this.getPreferencesForContact(contact);
			const baseNextDate = this.calculatePreliminaryDate(lastContactDate, frequency);
			const dt = DateTime.fromJSDate(baseNextDate).setZone(this.timeZone);
			let targetDate = dt;

			// Only adjust for preferred days if they exist
			if (
				Array.isArray(preferences.preferred_days) &&
				preferences.preferred_days.length > 0 &&
				frequency !== 'daily'
			) {
				const daysMap = {
					sunday: 7,
					monday: 1,
					tuesday: 2,
					wednesday: 3,
					thursday: 4,
					friday: 5,
					saturday: 6,
				};

				const currentDayNum = dt.weekday;
				const preferredDayNums = preferences.preferred_days
					.map((day) => daysMap[day.toLowerCase()])
					.filter((num) => num);

				if (preferredDayNums.length > 0) {
					// Get all possible dates in the next week for preferred days
					const possibleDates = [];
					for (let i = 0; i < 7; i++) {
						const checkDate = dt.plus({ days: i });
						if (preferredDayNums.includes(checkDate.weekday)) {
							// Check for existing reminders on this day
							const dayStart = checkDate.startOf('day');
							const dayEnd = checkDate.endOf('day');
							const hasReminder = this.reminders.some((reminder) => {
								const reminderDate = DateTime.fromJSDate(reminder.scheduledTime.toDate());
								return reminderDate >= dayStart && reminderDate <= dayEnd;
							});

							if (!hasReminder) {
								possibleDates.push(checkDate);
							}
						}
					}

					if (possibleDates.length > 0) {
						targetDate = possibleDates[0];
					} else {
						let daysToAdd = 0;
						while (!preferredDayNums.includes(((currentDayNum + daysToAdd - 1) % 7) + 1)) {
							daysToAdd++;
							if (daysToAdd > 7) break;
						}
						targetDate = dt.plus({ days: daysToAdd });
					}
				}
			}
			// Get active hours with fallback
			const activeHours = preferences.active_hours || { start: '09:00', end: '17:00' };
			const [startHour] = activeHours.start.split(':').map(Number);
			const [endHour] = activeHours.end.split(':').map(Number);

			// Check if the current day and next week are completely full
			const workingMinutes = (endHour - startHour) * 60;
			const slotsPerDay = Math.floor(workingMinutes / TIME_SLOT_INTERVAL);

			// Count slots for current day and next week
			const currentDayStart = targetDate.startOf('day');
			const nextWeekEnd = currentDayStart.plus({ days: 7 }).endOf('day');

			const existingSlots = this.reminders.filter((r) => {
				const reminderDate = DateTime.fromJSDate(r.scheduledTime.toDate());
				return reminderDate >= currentDayStart && reminderDate <= nextWeekEnd;
			});

			const daySlots = new Set(
				existingSlots.map((r) => {
					const d = DateTime.fromJSDate(r.scheduledTime.toDate());
					return `${d.toFormat('yyyy-MM-dd')}-${d.hour}:${d.minute}`;
				})
			);

			// If we have filled all slots for the next week
			if (daySlots.size >= slotsPerDay * 5) {
				// 5 working days
				return {
					status: 'SLOTS_FILLED',
					message: 'This day is fully booked. Would you like to:',
					options: ['Try the next available day', 'Schedule for next week'],
					details: {
						date: targetDate.toFormat('cccc, LLLL d'),
						workingHours: `${activeHours.start} - ${activeHours.end}`,
						nextAvailableDay: await this.findNextAvailableDay(targetDate.toJSDate(), contact),
					},
				};
			}

			// Generate potential time slots
			const slots = [];
			let currentSlot = targetDate.set({ hour: startHour, minute: 0 });
			const endTime = targetDate.set({ hour: endHour, minute: 0 });

			while (currentSlot <= endTime) {
				if (
					!this.hasTimeConflict(currentSlot.toJSDate(), contact) &&
					!this.isTimeBlocked(currentSlot.toJSDate(), contact)
				) {
					// Random minutes within the 15-minute slot
					const randomMinutes = Math.floor(Math.random() * TIME_SLOT_INTERVAL);
					const slotWithRandomMinutes = currentSlot.plus({ minutes: randomMinutes });

					slots.push({
						scheduledTime: slotWithRandomMinutes.toJSDate(),
						score: this.calculateTimeSlotScore(slotWithRandomMinutes.toJSDate(), contact),
					});
				}
				currentSlot = currentSlot.plus({ minutes: TIME_SLOT_INTERVAL });
			}

			if (slots.length === 0) {
				// Check if the day is completely full
				const workingMinutes = (endHour - startHour) * 60;
				const availableSlots = Math.floor(workingMinutes / TIME_SLOT_INTERVAL);
				const existingSlots = new Set(
					this.reminders.map((r) => {
						const d = DateTime.fromJSDate(r.scheduledTime.toDate());
						return `${d.hour}:${d.minute}`;
					})
				);

				if (existingSlots.size >= availableSlots) {
					const nextDay = await this.findNextAvailableDay(targetDate.toJSDate(), contact);
					return {
						status: 'SLOTS_FILLED',
						message: 'This day is fully booked. Would you like to:',
						options: ['Try the next available day', 'Schedule for next week'],
						details: {
							date: targetDate.toFormat('cccc, LLLL d'),
							workingHours: `${activeHours.start} - ${activeHours.end}`,
							nextAvailableDay: nextDay,
						},
					};
				}

				return this.resolveConflict(targetDate.toJSDate(), contact);
			}

			// Sort and select slot
			slots.sort((a, b) => b.score - a.score);
			const topSlots = slots.slice(0, Math.min(3, slots.length));
			const selectedSlot = topSlots[Math.floor(Math.random() * topSlots.length)];

			this.reminders.push({
				scheduledTime: Timestamp.fromDate(selectedSlot.scheduledTime),
				notified: false,
				type: 'SCHEDULED',
				contact_id: contact.id,
				user_id: contact.user_id,
				status: 'pending',
				snoozed: false,
				needs_attention: false,
				completed: false,
				completion_time: null,
				notes_added: false,
				contactName: `${contact.first_name} ${contact.last_name}`,
				created_at: Timestamp.now(),
				updated_at: Timestamp.now(),
			});

			return {
				scheduledTime: Timestamp.fromDate(selectedSlot.scheduledTime),
				contact_id: contact.id,
				created_at: Timestamp.now(),
				updated_at: Timestamp.now(),
				snoozed: false,
				needs_attention: false,
				ai_suggestions: [],
				score: selectedSlot.score,
				flexibility_used: selectedSlot.scheduledTime.getTime() !== baseNextDate.getTime(),
			};
		} catch (error) {
			console.error('Error in scheduleReminder:', error);
			throw error;
		}
	}

	findNextAvailableDay(date, contact) {
		const dt = DateTime.fromJSDate(date);
		const preferences = this.getPreferencesForContact(contact);

		for (let i = 1; i <= 7; i++) {
			const nextDay = dt.plus({ days: i });
			const { start, end } = preferences.active_hours || { start: '09:00', end: '17:00' };
			const [startHour] = start.split(':').map(Number);
			const [endHour] = end.split(':').map(Number);
			const dayStart = nextDay.set({ hour: startHour, minute: 0 });
			const dayEnd = nextDay.set({ hour: endHour, minute: 0 });

			// Check if this day has any slots available
			const dayReminders = this.reminders.filter((r) => {
				const reminderDate = DateTime.fromJSDate(r.scheduledTime.toDate());
				return reminderDate >= dayStart && reminderDate <= dayEnd;
			});

			// Check if it's a preferred day (if any are specified)
			const dayName = nextDay.weekdayLong.toLowerCase();
			if (preferences?.preferred_days?.length && !preferences.preferred_days.includes(dayName)) {
				continue;
			}

			if (dayReminders.length < 32) {
				// 32 is max number of 15-min slots
				return nextDay.toFormat('cccc, LLLL d');
			}
		}
		return null;
	}

	// Recurring Reminder Scheduling
	async scheduleRecurringReminder(contact, lastContactDate, frequency) {
		try {
			const baseSchedule = await this.scheduleReminder(contact, lastContactDate, frequency);
			if (baseSchedule.status === 'SLOTS_FILLED') {
				return baseSchedule;
			}

			try {
				const patterns = await schedulingHistory.analyzeContactPatterns(contact.id, 90);

				if (patterns?.lastUpdated) {
					const lastUpdate = DateTime.fromISO(patterns.lastUpdated);
					const daysSinceUpdate = DateTime.now().diff(lastUpdate, 'days').days;

					if (daysSinceUpdate > MAX_AGE_DAYS) {
						return {
							...baseSchedule,
							frequency: frequency,
							pattern_adjusted: false,
							recurring_next_date: baseSchedule.scheduledTime.toDate().toISOString(),
						};
					}
				}

				if (patterns?.confidence >= RECURRENCE_METADATA.MIN_CONFIDENCE) {
					const suggestedTime = await schedulingHistory.suggestOptimalTime(
						contact.id,
						DateTime.fromJSDate(baseSchedule.scheduledTime.toDate()),
						'recurring'
					);

					if (suggestedTime) {
						const suggestedJSDate = suggestedTime.toJSDate();
						if (!this.isTimeBlocked(suggestedJSDate, contact) && !this.hasTimeConflict(suggestedJSDate)) {
							return {
								...baseSchedule,
								scheduledTime: Timestamp.fromDate(suggestedJSDate),
								frequency: frequency,
								pattern_adjusted: true,
								confidence: patterns.confidence,
								recurring_next_date: suggestedTime.toISO(),
							};
						}
					}
				}
			} catch (error) {
				// Silently fall back to base schedule
			}

			// Return base schedule if pattern analysis fails or suggested time is blocked
			return {
				...baseSchedule,
				frequency: frequency,
				pattern_adjusted: false,
				recurring_next_date: baseSchedule.scheduledTime.toDate().toISOString(),
			};
		} catch (error) {
			console.error('Error in scheduleRecurringReminder:', error);
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
			const typePrefs = this.userPreferences?.relationship_types?.[contact.scheduling?.relationship_type];
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
				scheduledTime: Timestamp.fromDate(scheduledDate),
				contact_id: contact.id,
				created_at: Timestamp.now(),
				updated_at: Timestamp.now(),
				snoozed: false,
				FOLLOW_UP: false,
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
		const typePrefs = this.userPreferences?.relationship_types?.[contact.scheduling?.relationship_type];
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

	calculateTimeSlotScore(proposedTime, existingReminders) {
		const optimalGap = this.userPreferences?.scheduling_preferences?.optimalGapMinutes || 1440;
		let score = 100;

		// Check gaps with existing reminders
		for (const reminder of this.reminders) {
			const reminderTime = reminder.scheduledTime.toDate().getTime();
			const gap = Math.abs(proposedTime.getTime() - reminderTime) / (1000 * 60);

			// Reduce score based on how far from optimal gap
			const gapDifference = Math.abs(gap - optimalGap);
			score -= (gapDifference / optimalGap) * 50; // Adjust score weight
		}

		return Math.max(0, score);
	}

	calculateDistanceScore(dateTime) {
		if (this.reminders.length === 0) return 1.0;

		const minGap = this.userPreferences?.scheduling_preferences?.minimumGapMinutes || 20;
		const optimalGap = this.userPreferences?.scheduling_preferences?.optimalGapMinutes || 1440;

		const timeToCheck = dateTime.getTime();
		const gaps = this.reminders.map((reminder) => {
			const reminderTime = reminder.scheduledTime.toDate().getTime();
			return Math.abs(timeToCheck - reminderTime) / (1000 * 60);
		});

		const currentGap = Math.min(...gaps);
		if (currentGap < minGap) return 0;
		if (currentGap >= optimalGap) return 1.0;
		return (currentGap - minGap) / (optimalGap - minGap);
	}

	calculatePositionScore(dateTime, contact) {
		const preferences = this.getPreferencesForContact(contact);
		if (!preferences?.active_hours) return 0.5;

		const { start, end } = preferences.active_hours;
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

		const preferences = this.getPreferencesForContact(contact);
		if (preferences?.active_hours) {
			const [startHour] = preferences.active_hours.start.split(':').map(Number);
			const [endHour] = preferences.active_hours.end.split(':').map(Number);
			const workingMinutes = (endHour - startHour) * 60;
			const availableSlots = Math.floor(workingMinutes / TIME_SLOT_INTERVAL);

			const existingSlots = new Set(
				this.reminders.map((r) => {
					const d = DateTime.fromJSDate(r.scheduledTime.toDate());
					return `${d.hour}:${d.minute}`;
				})
			);

			if (existingSlots.size >= availableSlots) {
				throw new Error('Maximum scheduling attempts exceeded');
			}
		}

		const afternoonSlot = await this.shiftWithinDay(date, contact);
		if (afternoonSlot) {
			return afternoonSlot;
		}

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

		throw new Error('Maximum scheduling attempts exceeded');
	}

	async findNearestPreferredDay(date, contact) {
		const preferences = this.getPreferencesForContact(contact);
		if (!preferences?.preferred_days?.length) return null;

		const priority = contact.scheduling?.priority?.toLowerCase() || 'normal';
		const flexibility = PRIORITY_FLEXIBILITY[priority];
		const dt = DateTime.fromJSDate(date).setZone(this.timeZone);

		for (let i = 0; i <= flexibility; i++) {
			for (const direction of [1, -1]) {
				const checkDate = dt.plus({ days: i * direction });
				const dayName = checkDate.weekdayLong.toLowerCase();

				if (preferences.preferred_days.includes(dayName)) {
					const candidateDate = this.findAvailableTimeSlot(checkDate.toJSDate(), contact);
					if (candidateDate) return candidateDate;
				}
			}
		}

		return null;
	}

	async shiftWithinDay(date, contact) {
		const preferences = this.getPreferencesForContact(contact);
		if (!preferences?.active_hours) return null;

		const { start, end } = preferences.active_hours;
		const [startHour, startMinute] = start.split(':').map(Number);
		const [endHour, endMinute] = end.split(':').map(Number);

		const dt = DateTime.fromJSDate(date).setZone(this.timeZone);
		const dayEnd = dt.set({ hour: endHour, minute: endMinute });

		let current = dt.set({ hour: 14, minute: 0 });

		while (current <= dayEnd) {
			const testTime = current.toJSDate();
			if (!this.hasTimeConflict(testTime, contact) && !this.isTimeBlocked(testTime, contact)) {
				return testTime;
			}
			current = current.plus({ minutes: TIME_SLOT_INTERVAL });
		}

		return null;
	}

	async expandTimeRange(date, contact) {
		const preferences = this.getPreferencesForContact(contact);
		if (!preferences?.active_hours) return null;

		const { start, end } = preferences.active_hours;
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

	// Gap Scheduling
	validateGapRequirements(proposedTime, userPreferences) {
		const minGap = userPreferences?.scheduling_preferences?.minimumGapMinutes || 20; // fallback to 20
		const optimalGap = userPreferences?.scheduling_preferences?.optimalGapMinutes || 1440;

		const dt = DateTime.fromJSDate(proposedTime).setZone(this.timeZone);

		// Check existing reminders
		const conflicts = this.reminders.filter((reminder) => {
			const reminderTime = reminder.scheduledTime.toDate().getTime();
			const proposedTimeMs = proposedTime.getTime();
			const gapMinutes = Math.abs(proposedTimeMs - reminderTime) / (1000 * 60);
			return gapMinutes < minGap;
		});

		if (conflicts.length > 0) {
			return {
				isValid: false,
				conflicts,
				reason: `Too close to existing reminder(s). Minimum gap is ${minGap} minutes.`,
			};
		}

		return { isValid: true };
	}

	findNextAvailableTimeWithGap(baseTime, userPreferences) {
		const minGap = userPreferences?.scheduling_preferences?.minimumGapMinutes || 5;
		const optimalGap = userPreferences?.scheduling_preferences?.optimalGapMinutes || 1440;

		let currentTime = DateTime.fromJSDate(baseTime).setZone(this.timeZone);
		const maxAttempts = 48; // Try up to 48 slots (12 hours with 15-min intervals)

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			const proposedTime = currentTime.toJSDate();
			const validation = this.validateGapRequirements(proposedTime, userPreferences);

			if (validation.isValid) {
				return proposedTime;
			}

			// Move to next time slot (15-minute intervals)
			currentTime = currentTime.plus({ minutes: TIME_SLOT_INTERVAL });
		}

		throw new Error('No available time slot found within reasonable range');
	}

	adjustTimeForGaps(proposedTime, contact, userPreferences) {
		// First try the exact proposed time
		const validation = this.validateGapRequirements(proposedTime, userPreferences);
		if (validation.isValid) {
			return proposedTime;
		}

		// If that doesn't work, find the next available time that respects gaps
		const adjustedTime = this.findNextAvailableTimeWithGap(proposedTime, userPreferences);

		// Validate the adjusted time against contact preferences
		if (this.isTimeBlocked(adjustedTime, contact)) {
			// If blocked, try to find a slot that works for both gaps and contact preferences
			return this.findAvailableTimeSlot(adjustedTime, contact);
		}

		return adjustedTime;
	}

	async scheduleNotificationForReminder(reminder) {
		if (!reminder?.scheduledTime) {
			console.error('No scheduledTime found for reminder:', reminder);
			return;
		}

		let scheduledTime;
		try {
			// Handle different scheduledTime formats
			if (reminder.scheduledTime instanceof Date) {
				scheduledTime = reminder.scheduledTime;
			} else if (typeof reminder.scheduledTime === 'string') {
				scheduledTime = new Date(reminder.scheduledTime);
			} else if (reminder.scheduledTime.toDate) {
				scheduledTime = reminder.scheduledTime.toDate();
			} else {
				throw new Error('Invalid scheduledTime format');
			}

			if (isNaN(scheduledTime.getTime())) {
				throw new Error('Invalid date value');
			}
		} catch (error) {
			console.error('Invalid scheduledTime format:', reminder.scheduledTime, error);
			return;
		}

		const notificationContent = {
			title: `Scheduled Call: ${reminder.contactName || 'Contact'}`,
			body: `Time to connect with ${reminder.contactName || 'your contact'}`,
			data: {
				type: 'SCHEDULED',
				reminderId: reminder.id,
				contactId: reminder.contact_id,
				userId: reminder.user_id,
			},
		};

		try {
			await scheduleLocalNotificationWithPush(reminder.user_id, notificationContent, scheduledTime);
		} catch (error) {
			console.error('Error scheduling notification:', error);
			throw error;
		}
	}
}
