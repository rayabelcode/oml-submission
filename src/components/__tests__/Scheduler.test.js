import { jest } from '@jest/globals';
import { SchedulingService } from '../../utils/scheduler';
import { DateTime } from 'luxon';

jest.mock('firebase/firestore', () => ({
	Timestamp: {
		fromDate: (date) => ({
			toDate: () => date,
			_seconds: Math.floor(date.getTime() / 1000),
			_nanoseconds: (date.getTime() % 1000) * 1000000,
		}),
		now: () => {
			const now = new Date();
			return {
				toDate: () => now,
				_seconds: Math.floor(now.getTime() / 1000),
				_nanoseconds: (now.getTime() % 1000) * 1000000,
			};
		},
	},
	initializeFirestore: jest.fn(),
	persistentLocalCache: jest.fn(() => ({})),
	persistentMultipleTabManager: jest.fn(() => ({})),
}));

const mockUserPreferences = {
	relationship_types: {
		friend: {
			active_hours: { start: '09:00', end: '17:00' },
			preferred_days: ['monday', 'wednesday', 'friday'],
			excluded_times: [],
		},
		work: {
			active_hours: { start: '09:00', end: '17:00' },
			preferred_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
			excluded_times: [
				{
					days: ['monday', 'wednesday', 'friday'],
					start: '12:00',
					end: '13:00',
				},
			],
		},
	},
	global_excluded_times: [
		{
			days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
			start: '23:00',
			end: '07:00',
		},
	],
};

describe('Contact Spreading', () => {
	let schedulingService;

	beforeEach(() => {
		schedulingService = new SchedulingService(mockUserPreferences, [], 'America/New_York');
	});
	it('should spread contacts across preferred days', async () => {
		const baseContact = {
			id: 'test-id',
			scheduling: {
				custom_schedule: true,
				custom_preferences: {
					active_hours: { start: '09:00', end: '17:00' },
					preferred_days: ['tuesday', 'wednesday', 'thursday'],
				},
				priority: 'normal',
				minimum_gap: 30,
			},
		};

		// Create three contacts with same preferences
		const contacts = Array.from({ length: 3 }, (_, i) => ({
			...baseContact,
			id: `test-id-${i}`,
		}));

		const lastContactDate = DateTime.now().toJSDate();
		const results = [];

		// Schedule all contacts
		for (const contact of contacts) {
			const result = await schedulingService.scheduleReminder(contact, lastContactDate, 'weekly');
			results.push(result);
		}

		// Check that they're on different days
		const scheduledDays = new Set(results.map((r) => DateTime.fromJSDate(r.date.toDate()).weekday));
		expect(scheduledDays.size).toBe(3);
	});

	it('should respect user gap preferences over contact gaps', () => {
		const userPrefsWithGaps = {
			...mockUserPreferences,
			scheduling_preferences: {
				minimumGapMinutes: 20,
				optimalGapMinutes: 1440,
			},
		};

		const schedulingService = new SchedulingService(userPrefsWithGaps, [], 'America/New_York');

		// Create a reminder at 10:00
		schedulingService.reminders = [
			{
				date: {
					toDate: () =>
						DateTime.fromObject(
							{ year: 2024, month: 1, day: 1, hour: 10, minute: 0 },
							{ zone: 'America/New_York' }
						).toJSDate(),
				},
			},
		];

		// Try scheduling something 15 minutes later (should fail)
		const tooClose = DateTime.fromObject(
			{ year: 2024, month: 1, day: 1, hour: 10, minute: 15 },
			{ zone: 'America/New_York' }
		).toJSDate();

		// Try scheduling something 25 minutes later (should succeed)
		const farEnough = DateTime.fromObject(
			{ year: 2024, month: 1, day: 1, hour: 10, minute: 25 },
			{ zone: 'America/New_York' }
		).toJSDate();

		expect(schedulingService.hasTimeConflict(tooClose)).toBeTruthy();
		expect(schedulingService.hasTimeConflict(farEnough)).toBeFalsy();
	});

	it('should use default gap when user preferences are missing', () => {
		const schedulingService = new SchedulingService({}, [], 'America/New_York');

		// Create a reminder at 10:00
		schedulingService.reminders = [
			{
				date: {
					toDate: () =>
						DateTime.fromObject(
							{ year: 2024, month: 1, day: 1, hour: 10, minute: 0 },
							{ zone: 'America/New_York' }
						).toJSDate(),
				},
			},
		];

		// Try scheduling something 15 minutes later (should fail as default is 20)
		const tooClose = DateTime.fromObject(
			{ year: 2024, month: 1, day: 1, hour: 10, minute: 15 },
			{ zone: 'America/New_York' }
		).toJSDate();

		expect(schedulingService.hasTimeConflict(tooClose)).toBeTruthy();
	});

	it('should respect minimum gaps between contacts', async () => {
		const userPrefsWithGaps = {
			...mockUserPreferences,
			scheduling_preferences: {
				minimumGapMinutes: 120,
				optimalGapMinutes: 1440,
			},
		};

		const schedulingService = new SchedulingService(userPrefsWithGaps, [], 'America/New_York');

		const contact = {
			id: 'test-id',
			scheduling: {
				custom_schedule: true,
				custom_preferences: {
					active_hours: { start: '09:00', end: '17:00' },
					preferred_days: ['monday'],
				},
				priority: 'normal',
			},
		};

		const lastContactDate = DateTime.now().toJSDate();
		const result1 = await schedulingService.scheduleReminder(contact, lastContactDate, 'weekly');
		const result2 = await schedulingService.scheduleReminder(contact, lastContactDate, 'weekly');

		const time1 = result1.date.toDate().getTime();
		const time2 = result2.date.toDate().getTime();
		const gap = Math.abs(time2 - time1) / (1000 * 60); // gap in minutes

		expect(gap).toBeGreaterThanOrEqual(120);
	});
});

describe('Custom Preferences', () => {
	let schedulingService;

	beforeEach(() => {
		schedulingService = new SchedulingService(mockUserPreferences, [], 'America/New_York');
	});
	it('should use custom schedule when available', async () => {
		const contact = {
			id: 'test-id',
			scheduling: {
				custom_schedule: true,
				custom_preferences: {
					active_hours: { start: '12:00', end: '20:00' },
					preferred_days: ['saturday', 'sunday'],
				},
				relationship_type: 'friend',
			},
		};

		const result = await schedulingService.scheduleReminder(contact, DateTime.now().toJSDate(), 'weekly');

		const scheduledDateTime = DateTime.fromJSDate(result.date.toDate());
		expect(['6', '7']).toContain(scheduledDateTime.weekday.toString());
		expect(scheduledDateTime.hour).toBeGreaterThanOrEqual(12);
		expect(scheduledDateTime.hour).toBeLessThan(20);
	});

	it('should fall back to relationship type preferences when no custom schedule', async () => {
		const contact = {
			id: 'test-id',
			scheduling: {
				custom_schedule: false,
				relationship_type: 'work',
			},
		};

		const result = await schedulingService.scheduleReminder(contact, DateTime.now().toJSDate(), 'weekly');

		const scheduledDateTime = DateTime.fromJSDate(result.date.toDate());
		expect(scheduledDateTime.weekday).toBeLessThanOrEqual(5); // Monday-Friday
		expect(scheduledDateTime.hour).toBeGreaterThanOrEqual(9);
		expect(scheduledDateTime.hour).toBeLessThan(17);
	});
});

describe('SchedulingService', () => {
	let schedulingService;

	beforeEach(() => {
		jest.clearAllMocks();
		schedulingService = new SchedulingService(mockUserPreferences, [], 'America/New_York');
	});

	describe('Basic Functionality', () => {
		it('should initialize with correct preferences', () => {
			expect(schedulingService.userPreferences).toBeDefined();
			expect(schedulingService.globalExcludedTimes).toBeDefined();
		});

		it('should handle missing preferences gracefully', () => {
			const serviceWithNoPrefs = new SchedulingService(null, [], 'America/New_York');
			expect(serviceWithNoPrefs.userPreferences).toBeNull();
			expect(serviceWithNoPrefs.globalExcludedTimes).toEqual([]);
		});
	});

	describe('Date Calculations', () => {
		it('should calculate preliminary date correctly', () => {
			const startDate = new Date('2024-01-01T12:00:00Z');
			const result = schedulingService.calculatePreliminaryDate(startDate, 'weekly');
			expect(result.getTime()).toBe(new Date('2024-01-08T12:00:00Z').getTime());
		});

		it('should handle invalid frequency', () => {
			const startDate = new Date('2024-01-01T12:00:00Z');
			expect(() => {
				schedulingService.calculatePreliminaryDate(startDate, 'invalid');
			}).toThrow('Invalid frequency: invalid');
		});
	});

	describe('Time Blocking', () => {
		const mockContact = {
			scheduling: {
				relationship_type: 'work',
				custom_preferences: {
					active_hours: { start: '09:00', end: '17:00' },
				},
			},
		};

		it('should block default iOS reminder times', () => {
			const defaultTime = new Date('2024-01-01T09:00:00');
			expect(schedulingService.isTimeBlocked(defaultTime, mockContact)).toBeTruthy();

			const nonBlockedTime = new Date('2024-01-01T10:00:00');
			expect(schedulingService.isTimeBlocked(nonBlockedTime, mockContact)).toBeFalsy();
		});

		it('should respect global excluded times', () => {
			const mockContact = {
				scheduling: {
					relationship_type: 'work',
					custom_schedule: false,
				},
			};

			// Use a specific Monday for consistent testing
			const monday = DateTime.fromObject(
				{ year: 2024, month: 1, day: 1 }, // This is a Monday
				{ zone: 'America/New_York' }
			);

			// Test during excluded period (23:00-07:00)
			const nightTime = monday.set({ hour: 23, minute: 30 }).toJSDate();
			const earlyMorning = monday.set({ hour: 6, minute: 30 }).toJSDate();
			const dayTime = monday.set({ hour: 10, minute: 0 }).toJSDate();

			// Debug info
			console.log('Testing excluded times:', {
				contact: mockContact,
				preferences: schedulingService.getPreferencesForContact(mockContact),
				globalExcludedTimes: schedulingService.globalExcludedTimes,
				testTime: DateTime.fromJSDate(nightTime).toFormat('cccc HH:mm'),
				weekday: DateTime.fromJSDate(nightTime).weekdayLong.toLowerCase(),
			});

			expect(schedulingService.isTimeBlocked(nightTime, mockContact)).toBeTruthy();
			expect(schedulingService.isTimeBlocked(earlyMorning, mockContact)).toBeTruthy();
			expect(schedulingService.isTimeBlocked(dayTime, mockContact)).toBeFalsy();
		});

		it('should handle work hours correctly', () => {
			const workContact = {
				scheduling: {
					relationship_type: 'work',
					custom_preferences: {
						active_hours: { start: '09:00', end: '17:00' },
					},
				},
			};

			// Set to Monday at 12:30 PM
			const lunchTime = DateTime.fromObject(
				{ year: 2024, month: 1, day: 1, hour: 12, minute: 30 },
				{ zone: 'America/New_York' }
			).toJSDate();

			expect(schedulingService.isTimeBlocked(lunchTime, workContact)).toBeTruthy();
		});
	});

	describe('Multi-day Scheduling', () => {
		const WEEKDAYS = {
			MONDAY: 1,
			TUESDAY: 2,
			WEDNESDAY: 3,
			THURSDAY: 4,
			FRIDAY: 5,
		};

		let schedulingService;

		beforeEach(() => {
			schedulingService = new SchedulingService(mockUserPreferences, [], 'America/New_York');
		});

		it('should automatically check next day when current day is full', async () => {
			// Fill up Monday completely
			const monday = DateTime.now().startOf('week').plus({ days: 1 });
			schedulingService.reminders = Array.from({ length: 32 }, (_, i) => ({
				date: {
					toDate: () =>
						monday
							.plus({
								hours: 9 + Math.floor(i / 4),
								minutes: (i % 4) * 15,
							})
							.toJSDate(),
				},
			}));

			const contact = {
				id: 'test-id',
				scheduling: {
					relationship_type: 'work',
					custom_preferences: {
						active_hours: { start: '09:00', end: '17:00' },
						preferred_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
					},
				},
			};

			// Try to schedule on Monday
			const result = await schedulingService.findAvailableTimeSlot(
				monday.set({ hour: 10 }).toJSDate(),
				contact
			);

			// Verify it scheduled for Tuesday
			const scheduledDate = DateTime.fromJSDate(result);
			expect(scheduledDate.weekday).toBe(3); // Wednesday
			expect(scheduledDate.hour).toBeGreaterThanOrEqual(9);
			expect(scheduledDate.hour).toBeLessThan(17);
		});

		it('should find next available day within the week', async () => {
			// Fill Monday through Wednesday
			const monday = DateTime.now().startOf('week').plus({ days: 1 });
			const filledDays = [];

			for (let day = 0; day < 3; day++) {
				const currentDay = monday.plus({ days: day });
				filledDays.push(
					...Array.from({ length: 32 }, (_, i) => ({
						date: {
							toDate: () =>
								currentDay
									.plus({
										hours: 9 + Math.floor(i / 4),
										minutes: (i % 4) * 15,
									})
									.toJSDate(),
						},
					}))
				);
			}

			schedulingService.reminders = filledDays;

			const contact = {
				id: 'test-id',
				scheduling: {
					relationship_type: 'work',
					custom_preferences: {
						active_hours: { start: '09:00', end: '17:00' },
						preferred_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
					},
				},
			};

			// Try to schedule on Monday
			const result = await schedulingService.findAvailableTimeSlot(
				monday.set({ hour: 10 }).toJSDate(),
				contact
			);

			// Verify it scheduled for Thursday
			const scheduledDate = DateTime.fromJSDate(result);
			expect(scheduledDate.weekday).toBe(5); // Friday
			expect(scheduledDate.hour).toBeGreaterThanOrEqual(9);
			expect(scheduledDate.hour).toBeLessThan(17);
		});
	});

	describe('Edge Cases', () => {
		const mockContact = {
			id: 'test-id',
			scheduling: {
				relationship_type: 'friend',
				priority: 'high',
				custom_preferences: {
					active_hours: { start: '09:00', end: '17:00' },
				},
			},
		};

		it('should handle DST transitions', () => {
			const dstTransitionDate = DateTime.fromObject(
				{ year: 2024, month: 3, day: 10, hour: 1, minute: 30 },
				{ zone: 'America/New_York' }
			);

			const result = DateTime.fromJSDate(
				schedulingService.calculatePreliminaryDate(dstTransitionDate.toJSDate(), 'weekly')
			).setZone('America/New_York');

			console.log('DST transition test:', {
				original: dstTransitionDate.toLocaleString(DateTime.DATETIME_FULL),
				result: result.toLocaleString(DateTime.DATETIME_FULL),
			});

			expect(result.hour).toBe(2);
			expect(result.minute).toBe(30);
		});

		it('should handle timezone edge cases', () => {
			const tzService = new SchedulingService(mockUserPreferences, [], 'Asia/Tokyo');

			const baseDate = new Date('2024-01-01T23:00:00');
			const result = tzService.findAvailableTimeSlot(baseDate, mockContact);

			console.log('Timezone test:', {
				original: baseDate.toLocaleString(),
				result: DateTime.fromJSDate(result).setZone('Asia/Tokyo').toLocaleString(DateTime.DATETIME_FULL),
			});

			const resultDateTime = DateTime.fromJSDate(result).setZone('Asia/Tokyo');
			expect(resultDateTime.hour).toBeGreaterThanOrEqual(9);
			expect(resultDateTime.hour).toBeLessThan(17);
		});

		it('should handle invalid timezone gracefully', () => {
			const invalidTzService = new SchedulingService(mockUserPreferences, [], 'Invalid/Timezone');
			const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
			expect(invalidTzService.timeZone).toBe(systemTz);
		});

		it('should handle concurrent scheduling requests', async () => {
			schedulingService.reminders = [];

			const baseDate = DateTime.now().set({ hour: 9, minute: 0 }).toJSDate();
			const promises = [];

			for (let i = 0; i < 10; i++) {
				const requestedTime = DateTime.fromJSDate(baseDate)
					.plus({ hours: Math.floor(i / 2), minutes: (i % 2) * 30 })
					.toJSDate();

				const contact = {
					...mockContact,
					id: `test-id-${i}`,
					scheduling: {
						relationship_type: 'friend',
						priority: 'normal',
						custom_preferences: {
							active_hours: { start: '09:00', end: '17:00' },
						},
					},
				};

				promises.push(schedulingService.scheduleReminder(contact, requestedTime, 'daily'));
			}

			const results = await Promise.all(promises);

			const times = results.map((r) => r.date.toDate().getTime());
			const uniqueTimes = new Set(times);

			expect(uniqueTimes.size).toBe(10);

			for (let i = 0; i < times.length; i++) {
				for (let j = i + 1; j < times.length; j++) {
					const gap = Math.abs(times[i] - times[j]) / (1000 * 60);
					expect(gap).toBeGreaterThanOrEqual(30);
				}
			}
		});

		it('should handle maximum scheduling attempts', async () => {
			const mockContact = {
				id: 'test-id',
				scheduling: {
					relationship_type: 'work',
					custom_schedule: false,
					minimum_gap: 15,
				},
			};

			// Fill up entire week
			const days = 5; // Monday through Friday
			const slotsPerDay = 32;
			const reminders = [];
			const startDate = DateTime.now().startOf('week').plus({ days: 1 }); // Start from Monday

			for (let day = 0; day < days; day++) {
				for (let slot = 0; slot < slotsPerDay; slot++) {
					reminders.push({
						date: {
							toDate: () =>
								startDate
									.plus({ days: day })
									.set({
										hour: 9 + Math.floor(slot / 4),
										minute: (slot % 4) * 15,
									})
									.toJSDate(),
						},
					});
				}
			}

			schedulingService.reminders = reminders;

			// Should return a user-friendly response when no slots are available
			const result = await schedulingService.scheduleReminder(
				mockContact,
				startDate.set({ hour: 10 }).toJSDate(),
				'daily'
			);

			expect(result.status).toBe('SLOTS_FILLED');
			expect(result.message).toBe('This day is fully booked. Would you like to:');
			expect(result.options).toEqual(['Try the next available day', 'Schedule for next week']);
		});

		it('should handle minimum gap requirements strictly', () => {
			const userPrefsWithGaps = {
				...mockUserPreferences,
				scheduling_preferences: {
					minimumGapMinutes: 30,
					optimalGapMinutes: 1440,
				},
			};

			const schedulingService = new SchedulingService(userPrefsWithGaps, [], 'America/New_York');

			const baseTime = DateTime.now().set({ hour: 12, minute: 0 }).toJSDate();
			schedulingService.reminders = [
				{
					date: {
						toDate: () => baseTime,
					},
				},
			];

			const tooClose = new Date(baseTime.getTime() + 29 * 60 * 1000); // 29 minutes
			const justRight = new Date(baseTime.getTime() + 30 * 60 * 1000); // 30 minutes

			expect(schedulingService.hasTimeConflict(tooClose)).toBeTruthy();
			expect(schedulingService.hasTimeConflict(justRight)).toBeFalsy();
		});
	});

	describe('Conflict Resolution', () => {
		it('should resolve conflicts using preferred day strategy', async () => {
			const contact = {
				id: 'test-id',
				scheduling: {
					relationship_type: 'friend',
					priority: 'high',
					custom_preferences: {
						active_hours: { start: '09:00', end: '17:00' },
					},
				},
			};

			schedulingService.reminders = [
				{
					date: {
						toDate: () => DateTime.now().set({ hour: 10, minute: 0 }).toJSDate(),
					},
				},
			];

			const conflictDate = DateTime.now().set({ hour: 10, minute: 15 }).toJSDate();
			const resolvedDate = await schedulingService.resolveConflict(conflictDate, contact);

			expect(resolvedDate).toBeDefined();
			expect(schedulingService.hasTimeConflict(resolvedDate)).toBeFalsy();
			expect(schedulingService.isTimeBlocked(resolvedDate, contact)).toBeFalsy();
		});

		it('should resolve conflicts by shifting within day', async () => {
			const contact = {
				id: 'test-id',
				scheduling: {
					relationship_type: 'friend',
					priority: 'normal',
					custom_preferences: {
						active_hours: { start: '09:00', end: '17:00' },
					},
				},
			};

			// Block morning hours
			schedulingService.reminders = Array.from({ length: 8 }, (_, i) => ({
				date: {
					toDate: () =>
						DateTime.now()
							.set({ hour: 9 + Math.floor(i / 2), minute: (i % 2) * 30 })
							.toJSDate(),
				},
			}));

			const conflictDate = DateTime.now().set({ hour: 9, minute: 30 }).toJSDate();
			const resolvedDate = await schedulingService.resolveConflict(conflictDate, contact);

			expect(resolvedDate).toBeDefined();
			const resolvedTime = DateTime.fromJSDate(resolvedDate);
			expect(resolvedTime.hour).toBeGreaterThan(13);
		});

		it('should resolve conflicts by expanding time range', async () => {
			const contact = {
				id: 'test-id',
				scheduling: {
					relationship_type: 'friend',
					priority: 'low',
					custom_preferences: {
						active_hours: { start: '09:00', end: '17:00' },
					},
				},
			};

			// Fill normal hours
			schedulingService.reminders = Array.from({ length: 16 }, (_, i) => ({
				date: {
					toDate: () =>
						DateTime.now()
							.set({ hour: 9 + i, minute: 0 })
							.toJSDate(),
				},
			}));

			const conflictDate = DateTime.now().set({ hour: 12, minute: 0 }).toJSDate();
			const resolvedDate = await schedulingService.resolveConflict(conflictDate, contact);

			expect(resolvedDate).toBeDefined();
			const resolvedTime = DateTime.fromJSDate(resolvedDate);
			expect(resolvedTime.hour).toBeGreaterThanOrEqual(8);
			expect(resolvedTime.hour).toBeLessThanOrEqual(18);
		});

		it('should throw error when no resolution is possible', async () => {
			const contact = {
				id: 'test-id',
				scheduling: {
					relationship_type: 'friend',
					priority: 'normal',
					custom_preferences: {
						active_hours: { start: '09:00', end: '17:00' },
					},
				},
			};

			// Fill all possible slots
			schedulingService.reminders = Array.from({ length: 32 }, (_, i) => ({
				date: {
					toDate: () =>
						DateTime.now()
							.set({ hour: 9 + Math.floor(i / 4), minute: (i % 4) * 15 })
							.toJSDate(),
				},
			}));

			const conflictDate = DateTime.now().set({ hour: 12, minute: 0 }).toJSDate();
			await expect(schedulingService.resolveConflict(conflictDate, contact)).rejects.toThrow(
				'Maximum scheduling attempts exceeded'
			);
		});
	});

	describe('User Experience', () => {
		let schedulingService;

		beforeEach(() => {
			schedulingService = new SchedulingService(mockUserPreferences, [], 'America/New_York');
		});

		it('should provide user-friendly options when all slots are filled', async () => {
			const mockContact = {
				id: 'test-id',
				scheduling: {
					relationship_type: 'work',
					custom_schedule: false,
					minimum_gap: 15,
				},
			};

			// Start on a Monday
			const monday = DateTime.fromObject(
				{ year: 2024, month: 1, day: 1 }, // Monday
				{ zone: 'America/New_York' }
			);

			schedulingService.reminders = [];

			// Fill EVERY slot for the entire week
			for (let day = 0; day < 5; day++) {
				// Monday through Friday
				const currentDay = monday.plus({ days: day });

				// Fill every slot from 9 AM to 5 PM
				for (let hour = 9; hour < 17; hour++) {
					for (let minute = 0; minute < 60; minute += 15) {
						const slotTime = currentDay.set({ hour, minute });
						schedulingService.reminders.push({
							date: {
								toDate: () => slotTime.toJSDate(),
								_seconds: Math.floor(slotTime.toSeconds()),
								_nanoseconds: 0,
							},
						});
					}
				}
			}

			// Fill the next week too to prevent finding slots there
			const nextMonday = monday.plus({ days: 7 });
			for (let day = 0; day < 5; day++) {
				const currentDay = nextMonday.plus({ days: day });
				for (let hour = 9; hour < 17; hour++) {
					for (let minute = 0; minute < 60; minute += 15) {
						const slotTime = currentDay.set({ hour, minute });
						schedulingService.reminders.push({
							date: {
								toDate: () => slotTime.toJSDate(),
								_seconds: Math.floor(slotTime.toSeconds()),
								_nanoseconds: 0,
							},
						});
					}
				}
			}

			console.log('User Experience Test:', {
				totalSlots: schedulingService.reminders.length,
				firstDaySlots: schedulingService.reminders
					.filter((r) => {
						const d = DateTime.fromJSDate(r.date.toDate());
						return d.toFormat('yyyy-MM-dd') === monday.toFormat('yyyy-MM-dd');
					})
					.map((r) => DateTime.fromJSDate(r.date.toDate()).toFormat('HH:mm')),
				firstDay: monday.toFormat('cccc, LLLL d'),
				nextWeekSlots: schedulingService.reminders.filter((r) => {
					const d = DateTime.fromJSDate(r.date.toDate());
					return d.toFormat('yyyy-MM-dd') === nextMonday.toFormat('yyyy-MM-dd');
				}).length,
			});

			const result = await schedulingService.scheduleReminder(
				mockContact,
				monday.set({ hour: 10, minute: 0 }).toJSDate(),
				'daily'
			);

			// Verify the user-friendly response
			expect(result.status).toBe('SLOTS_FILLED');
			expect(result.message).toBe('This day is fully booked. Would you like to:');
			expect(result.options).toEqual(['Try the next available day', 'Schedule for next week']);
		});
	});

	//Basic Performance Benchmarking
	describe('Performance Benchmarking', () => {
		let schedulingService;

		beforeEach(() => {
			schedulingService = new SchedulingService(mockUserPreferences, [], 'America/New_York');
		});

		const runBenchmark = async (operation, iterations = 100) => {
			const startTime = performance.now();
			const results = [];

			for (let i = 0; i < iterations; i++) {
				try {
					results.push(await operation(i));
				} catch (error) {
					// Skip failed operations
					continue;
				}
			}

			const endTime = performance.now();
			return {
				totalTime: endTime - startTime,
				averageTime: (endTime - startTime) / results.length,
				operationsPerSecond: 1000 / ((endTime - startTime) / results.length),
				successRate: (results.length / iterations) * 100,
				results,
			};
		};

		it('benchmarks custom time scheduling', async () => {
			const customDateOperation = (i) => {
				const baseDate = DateTime.now().set({ hour: 13, minute: 0 }); // Start at 1 PM
				const date = baseDate.plus({ days: Math.floor(i / 8), hours: i % 8 }).toJSDate();
				const contact = {
					id: `test-${i}`,
					scheduling: {
						custom_schedule: true,
						custom_next_date: true,
						custom_preferences: {
							active_hours: { start: '09:00', end: '17:00' },
							preferred_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
						},
					},
				};
				return schedulingService.findAvailableTimeSlot(date, contact);
			};

			const customResults = await runBenchmark(customDateOperation);
			console.log('Custom Date Scheduling Performance:', {
				totalTime: `${customResults.totalTime.toFixed(2)}ms`,
				averageTime: `${customResults.averageTime.toFixed(2)}ms`,
				operationsPerSecond: customResults.operationsPerSecond.toFixed(2),
				successRate: `${customResults.successRate.toFixed(2)}%`,
			});

			expect(customResults.successRate).toBeGreaterThan(90);
		});

		it('benchmarks recurring pattern scheduling', async () => {
			const recurringOperation = (i) => {
				const date = DateTime.now().plus({ days: i }).set({ hour: 13, minute: 0 }).toJSDate();
				const contact = {
					id: `test-${i}`,
					scheduling: {
						frequency: 'weekly',
						custom_schedule: false,
						relationship_type: 'work',
						custom_preferences: {
							active_hours: { start: '09:00', end: '17:00' },
							preferred_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
						},
					},
				};
				return schedulingService.findAvailableTimeSlot(date, contact);
			};

			const recurringResults = await runBenchmark(recurringOperation);
			console.log('Recurring Pattern Scheduling Performance:', {
				totalTime: `${recurringResults.totalTime.toFixed(2)}ms`,
				averageTime: `${recurringResults.averageTime.toFixed(2)}ms`,
				operationsPerSecond: recurringResults.operationsPerSecond.toFixed(2),
				successRate: `${recurringResults.successRate.toFixed(2)}%`,
			});

			expect(recurringResults.successRate).toBeGreaterThan(90);
		});
	});

	// Performance Stress Testing - Larger Datasets
	describe('Performance Stress Testing - Larger Datasets', () => {
		let schedulingService;

		beforeEach(() => {
			schedulingService = new SchedulingService(mockUserPreferences, [], 'America/New_York');
		});

		it('handles large existing reminder sets', async () => {
			const datasetSizes = [100, 500, 1000];
			const results = [];

			for (const size of datasetSizes) {
				const reminders = Array.from({ length: size }, (_, i) => ({
					date: {
						toDate: () =>
							DateTime.now()
								.plus({ days: Math.floor(i / 32) })
								.set({
									hour: 9 + Math.floor((i % 32) / 4),
									minute: (i % 4) * 15,
								})
								.toJSDate(),
					},
				}));

				schedulingService.reminders = reminders;

				const startTime = performance.now();
				const batchResults = await Promise.all(
					Array.from({ length: 10 }, (_, i) =>
						schedulingService.findAvailableTimeSlot(DateTime.now().plus({ days: i }).toJSDate(), {
							id: `test-${i}`,
							scheduling: {
								relationship_type: 'work',
								custom_preferences: {
									active_hours: { start: '09:00', end: '17:00' },
								},
							},
						})
					)
				);
				const endTime = performance.now();

				results.push({
					size,
					totalTime: (endTime - startTime).toFixed(2),
					averageTime: ((endTime - startTime) / 10).toFixed(2),
					operationsPerSecond: (10000 / (endTime - startTime)).toFixed(2),
				});
			}

			console.log('Large Dataset Performance:', results);
			expect(results.length).toBeGreaterThan(0);
		});

		it('handles long-term scheduling scenarios', async () => {
			// Generate a month of reminders
			const monthOfReminders = Array.from({ length: 30 * 32 }, (_, i) => ({
				date: {
					toDate: () =>
						DateTime.now()
							.plus({ days: Math.floor(i / 32) })
							.set({
								hour: 9 + Math.floor((i % 32) / 4),
								minute: (i % 4) * 15,
							})
							.toJSDate(),
				},
			}));

			schedulingService.reminders = monthOfReminders;

			const timeRanges = [7, 14, 21, 30]; // Days to schedule ahead
			const results = [];

			for (const days of timeRanges) {
				const startTime = performance.now();
				const operations = [];

				for (let i = 0; i < 10; i++) {
					const contact = {
						id: `test-${i}`,
						scheduling: {
							relationship_type: 'work',
							custom_preferences: {
								active_hours: { start: '09:00', end: '17:00' },
							},
						},
					};

					operations.push(
						schedulingService.findAvailableTimeSlot(
							DateTime.now()
								.plus({ days: Math.floor(Math.random() * days) })
								.toJSDate(),
							contact
						)
					);
				}

				const batchResults = await Promise.all(operations);
				const endTime = performance.now();
				const totalTime = endTime - startTime;

				results.push({
					daysAhead: days,
					totalTime: totalTime.toFixed(2),
					averageTime: (totalTime / 10).toFixed(2),
					operationsPerSecond: (10000 / totalTime).toFixed(2),
				});
			}

			console.log('Long-term Scheduling Performance:', results);
			expect(parseFloat(results[results.length - 1].operationsPerSecond)).toBeGreaterThan(3);
		});
	});
});
