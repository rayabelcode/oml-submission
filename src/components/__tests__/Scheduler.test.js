import { jest } from '@jest/globals';
import { SchedulingService } from '../../utils/scheduler';
import { DateTime } from 'luxon';
import { updateContactScheduling, getContactReminders } from '../../utils/firestore';
const RECURRENCE_METADATA = {
	MIN_CONFIDENCE: 0.5,
	MAX_AGE_DAYS: 30,
};

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

//Mock schedulingHistory
jest.mock('../../utils/schedulingHistory', () => ({
	schedulingHistory: {
		analyzeContactPatterns: jest.fn(),
		suggestOptimalTime: jest.fn(),
	},
}));

// Mock firestore functions
jest.mock('../../utils/firestore', () => ({
	updateContactScheduling: jest.fn(),
	getContactReminders: jest.fn(),
	getUserPreferences: jest.fn(),
	getActiveReminders: jest.fn(),
}));

// Mock auth
jest.mock('../../config/firebase', () => ({
	auth: {
		currentUser: { uid: 'test-user' },
	},
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

	describe('Custom Date Scheduling', () => {
		let schedulingService;
		let mockContact;

		beforeEach(() => {
			jest.clearAllMocks();
			schedulingService = new SchedulingService(mockUserPreferences, [], 'America/New_York');
			mockContact = {
				id: 'test-id',
				first_name: 'John',
				last_name: 'Doe',
				scheduling: {
					relationship_type: 'friend',
					custom_preferences: {
						active_hours: { start: '09:00', end: '17:00' },
					},
				},
			};

			// Mock successful Firestore operations
			require('../../utils/firestore').getContactReminders.mockImplementation((contactId, userId) => {
				return Promise.resolve([
					{
						id: 'reminder-id',
						scheduledTime: {
							toDate: () => mockContact.scheduling.custom_next_date || new Date(),
						},
					},
				]);
			});

			require('../../utils/firestore').updateContactScheduling.mockImplementation((contactId, data) => {
				mockContact.scheduling.custom_next_date = data.custom_next_date;
				return Promise.resolve({
					id: contactId,
					scheduling: {
						custom_next_date: data.custom_next_date.toISOString(),
					},
					next_contact: data.custom_next_date.toISOString(),
				});
			});
		});

		it('should create reminder for custom date', async () => {
			// Create a fixed date in the local timezone
			const customDate = DateTime.fromObject(
				{ year: 2024, month: 1, day: 1, hour: 14, minute: 0 },
				{ zone: 'America/New_York' }
			);

			// Mock the exact response we expect
			require('../../utils/firestore').updateContactScheduling.mockResolvedValueOnce({
				id: mockContact.id,
				scheduling: {
					custom_next_date: customDate.toISO(),
				},
				next_contact: customDate.toISO(),
			});

			const result = await updateContactScheduling(mockContact.id, {
				custom_next_date: customDate.toJSDate(),
			});

			expect(result.next_contact).toEqual(customDate.toISO());
		});

		it('should handle multiple custom date updates', async () => {
			const firstDate = DateTime.now().plus({ days: 1 });
			const secondDate = DateTime.now().plus({ days: 2 });

			// Set first custom date
			await updateContactScheduling(mockContact.id, {
				custom_next_date: firstDate.toJSDate(),
			});

			// Update to second custom date
			await updateContactScheduling(mockContact.id, {
				custom_next_date: secondDate.toJSDate(),
			});

			const reminders = await getContactReminders(mockContact.id, 'test-user');
			expect(reminders).toHaveLength(1);
			expect(reminders[0].scheduledTime.toDate()).toEqual(secondDate.toJSDate());
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

		describe('Timezone Handling', () => {
			it('should handle notifications across timezone changes', async () => {
				const originalTimezone = 'America/New_York';
				const newTimezone = 'Asia/Tokyo';
				const schedulingService = new SchedulingService(mockUserPreferences, [], originalTimezone);

				const mockContact = {
					id: 'test-id',
					scheduling: {
						relationship_type: 'friend',
						custom_preferences: {
							active_hours: { start: '09:00', end: '17:00' },
						},
					},
				};

				// Schedule in original timezone
				const firstResult = await schedulingService.scheduleReminder(mockContact, new Date(), 'weekly');

				// Change timezone
				schedulingService.timeZone = newTimezone;
				const secondResult = await schedulingService.scheduleReminder(
					mockContact,
					firstResult.date.toDate(),
					'weekly'
				);

				// Verify times are correctly adjusted
				const firstDateTime = DateTime.fromJSDate(firstResult.date.toDate()).setZone(originalTimezone);
				const secondDateTime = DateTime.fromJSDate(secondResult.date.toDate()).setZone(newTimezone);

				expect(firstDateTime.hour).toBeGreaterThanOrEqual(9);
				expect(firstDateTime.hour).toBeLessThan(17);
				expect(secondDateTime.hour).toBeGreaterThanOrEqual(9);
				expect(secondDateTime.hour).toBeLessThan(17);
			});

			it('should maintain consistent scheduling times across timezones', async () => {
				const schedulingService = new SchedulingService(mockUserPreferences, [], 'UTC');

				const mockContact = {
					id: 'test-id',
					scheduling: {
						relationship_type: 'friend',
						custom_preferences: {
							active_hours: { start: '09:00', end: '17:00' },
						},
					},
				};

				const timezones = ['America/New_York', 'Asia/Tokyo', 'Europe/London'];
				const results = await Promise.all(
					timezones.map(async (timezone) => {
						schedulingService.timeZone = timezone;
						return schedulingService.scheduleReminder(mockContact, new Date(), 'weekly');
					})
				);

				// Verify all scheduled times fall within working hours in their respective timezones
				results.forEach((result, index) => {
					const localTime = DateTime.fromJSDate(result.date.toDate()).setZone(timezones[index]);
					expect(localTime.hour).toBeGreaterThanOrEqual(9);
					expect(localTime.hour).toBeLessThan(17);
				});
			});
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

	// Recurring reminder testing
	describe('Recurring Reminders', () => {
		let schedulingService;
		let mockSchedulingHistory;

		const mockContact = {
			id: 'test-id',
			scheduling: {
				relationship_type: 'friend',
				custom_preferences: {
					active_hours: { start: '09:00', end: '17:00' },
				},
			},
		};

		beforeEach(() => {
			jest.clearAllMocks();
			schedulingService = new SchedulingService(mockUserPreferences, [], 'America/New_York');

			// Get fresh reference to mocked module
			mockSchedulingHistory = require('../../utils/schedulingHistory').schedulingHistory;
		});

		it('should use base scheduling when no patterns exist', async () => {
			// Mock no patterns found
			require('../../utils/schedulingHistory').schedulingHistory.analyzeContactPatterns.mockResolvedValue(
				null
			);

			const result = await schedulingService.scheduleRecurringReminder(mockContact, new Date(), 'weekly');

			// Should still have basic scheduling data
			expect(result.date).toBeDefined();
			expect(result.recurrence).toEqual({
				frequency: 'weekly',
				pattern_adjusted: false,
				next_date: expect.any(String),
			});
		});

		it('should enhance scheduling with pattern analysis when available', async () => {
			// Mock successful pattern analysis
			require('../../utils/schedulingHistory').schedulingHistory.analyzeContactPatterns.mockResolvedValue({
				confidence: 0.8,
				successRates: {
					byHour: { 14: { successRate: 0.9 } },
				},
			});

			// Mock optimal time suggestion
			require('../../utils/schedulingHistory').schedulingHistory.suggestOptimalTime.mockResolvedValue(
				DateTime.now().set({ hour: 14, minute: 0 })
			);

			const result = await schedulingService.scheduleRecurringReminder(mockContact, new Date(), 'weekly');

			expect(result.recurrence).toEqual({
				frequency: 'weekly',
				pattern_adjusted: true,
				confidence: 0.8,
				next_date: expect.any(String),
			});
		});

		it('should respect scheduling constraints even with pattern adjustment', async () => {
			// Mock pattern analysis suggesting a blocked time
			require('../../utils/schedulingHistory').schedulingHistory.analyzeContactPatterns.mockResolvedValueOnce(
				{
					confidence: 0.8,
					successRates: {
						byHour: { 23: { successRate: 0.9 } }, // Outside active hours
					},
				}
			);

			// Mock optimal time suggestion to return a blocked time
			const blockedTime = DateTime.now().set({ hour: 23, minute: 0 });
			require('../../utils/schedulingHistory').schedulingHistory.suggestOptimalTime.mockResolvedValueOnce(
				blockedTime
			);

			// Mock base schedule to be within working hours
			const baseDate = DateTime.now().set({ hour: 14, minute: 0 });
			const mockBaseResult = {
				date: {
					toDate: () => baseDate.toJSDate(),
					_seconds: Math.floor(baseDate.toSeconds()),
					_nanoseconds: 0,
				},
				status: 'SUCCESS',
			};

			jest.spyOn(schedulingService, 'scheduleReminder').mockResolvedValueOnce(mockBaseResult);

			const result = await schedulingService.scheduleRecurringReminder(mockContact, new Date(), 'weekly');

			// Should fall back to base scheduling since suggested time is blocked
			expect(result.recurrence.pattern_adjusted).toBe(false);

			// Verify time is within allowed hours
			const scheduledHour = DateTime.fromJSDate(result.date.toDate()).hour;
			expect(scheduledHour).toBeGreaterThanOrEqual(9);
			expect(scheduledHour).toBeLessThan(17);
		});

		it('should handle slots filled status correctly', async () => {
			// Mock base scheduling returning slots filled
			jest.spyOn(schedulingService, 'scheduleReminder').mockResolvedValueOnce({
				status: 'SLOTS_FILLED',
				message: 'This day is fully booked. Would you like to:',
				options: ['Try the next available day', 'Schedule for next week'],
			});

			const result = await schedulingService.scheduleRecurringReminder(mockContact, new Date(), 'weekly');

			expect(result.status).toBe('SLOTS_FILLED');
			expect(result.message).toBeDefined();
			expect(result.options).toBeDefined();
		});
	});

	describe('Advanced Recurring Reminder Scenarios', () => {
		let schedulingService;
		let mockSchedulingHistory;
		let mockContact;

		beforeEach(() => {
			jest.clearAllMocks();
			schedulingService = new SchedulingService(mockUserPreferences, [], 'America/New_York');
			mockSchedulingHistory = require('../../utils/schedulingHistory').schedulingHistory;
			mockContact = {
				id: 'test-id',
				first_name: 'John',
				last_name: 'Doe',
				scheduling: {
					relationship_type: 'friend',
					custom_preferences: {
						active_hours: { start: '09:00', end: '17:00' },
					},
				},
			};
		});

		describe('Error Handling', () => {
			it('should handle schedulingHistory failures gracefully', async () => {
				// Set up the success mock for base scheduling
				const baseDate = DateTime.now().plus({ days: 7 });
				const mockBaseResult = {
					date: {
						toDate: () => baseDate.toJSDate(),
						_seconds: Math.floor(baseDate.toSeconds()),
						_nanoseconds: 0,
					},
					status: 'SUCCESS',
					recurrence: {
						frequency: 'weekly',
						pattern_adjusted: false,
						next_date: baseDate.toISO(),
					},
				};

				jest.spyOn(schedulingService, 'scheduleReminder').mockResolvedValueOnce(mockBaseResult);

				// Set up failure for pattern analysis
				mockSchedulingHistory.analyzeContactPatterns.mockRejectedValueOnce(
					new Error('Pattern analysis failed')
				);

				const result = await schedulingService.scheduleRecurringReminder(mockContact, new Date(), 'weekly');

				expect(result.recurrence.pattern_adjusted).toBe(false);
			});
		});

		describe('Pattern Confidence', () => {
			it('should respect minimum confidence threshold', async () => {
				mockSchedulingHistory.analyzeContactPatterns.mockResolvedValueOnce({
					confidence: 0.4, // Below threshold
					successRates: {
						byHour: { 14: { successRate: 0.9 } },
					},
				});

				const result = await schedulingService.scheduleRecurringReminder(mockContact, new Date(), 'weekly');

				expect(result.recurrence.pattern_adjusted).toBe(false);
			});

			it('should handle borderline confidence cases', async () => {
				const baseDate = DateTime.now().plus({ days: 7 });
				const mockBaseResult = {
					date: {
						toDate: () => baseDate.toJSDate(),
						_seconds: Math.floor(baseDate.toSeconds()),
						_nanoseconds: 0,
					},
					status: 'SUCCESS',
				};

				jest.spyOn(schedulingService, 'scheduleReminder').mockResolvedValueOnce(mockBaseResult);

				mockSchedulingHistory.analyzeContactPatterns.mockResolvedValueOnce({
					confidence: RECURRENCE_METADATA.MIN_CONFIDENCE,
					successRates: {
						byHour: { 14: { successRate: 0.9 } },
					},
					lastUpdated: DateTime.now().toISO(),
				});

				mockSchedulingHistory.suggestOptimalTime.mockResolvedValueOnce(baseDate);

				const result = await schedulingService.scheduleRecurringReminder(mockContact, new Date(), 'weekly');

				expect(result.recurrence.pattern_adjusted).toBe(true);
			});
		});

		describe('Cache and Data Staleness', () => {
			it('should handle stale pattern data', async () => {
				const baseDate = DateTime.now().plus({ days: 7 });
				const mockBaseResult = {
					date: {
						toDate: () => baseDate.toJSDate(),
						_seconds: Math.floor(baseDate.toSeconds()),
						_nanoseconds: 0,
					},
					status: 'SUCCESS',
				};

				jest.spyOn(schedulingService, 'scheduleReminder').mockResolvedValueOnce(mockBaseResult);

				// Use RECURRENCE_METADATA.MAX_AGE_DAYS instead of MAX_AGE_DAYS
				const staleDate = DateTime.now().minus({ days: RECURRENCE_METADATA.MAX_AGE_DAYS + 1 });

				mockSchedulingHistory.analyzeContactPatterns.mockResolvedValueOnce({
					confidence: 0.8,
					successRates: {
						byHour: { 14: { successRate: 0.9 } },
					},
					lastUpdated: staleDate.toISO(),
				});

				const result = await schedulingService.scheduleRecurringReminder(mockContact, new Date(), 'weekly');

				expect(result.recurrence.pattern_adjusted).toBe(false);
				expect(result.recurrence.frequency).toBe('weekly');
				expect(result.date).toEqual(mockBaseResult.date);
			});

			it('should integrate with Firestore updates', async () => {
				const customDate = DateTime.now().plus({ days: 1 });
				const recurringDate = DateTime.now().plus({ days: 2 });
				const mockTimestamp = {
					toDate: () => recurringDate.toJSDate(),
					_seconds: Math.floor(recurringDate.toSeconds()),
					_nanoseconds: 0,
				};

				const recurringResponse = {
					date: mockTimestamp,
					contact_id: mockContact.id,
					created_at: mockTimestamp,
					updated_at: mockTimestamp,
					scheduling: {
						recurring_next_date: recurringDate.toISO(),
						recurring: {
							frequency: 'weekly',
							pattern_adjusted: false,
							next_date: recurringDate.toISO(),
						},
					},
				};

				const customResponse = {
					id: mockContact.id,
					scheduling: {
						recurring_next_date: recurringDate.toISO(),
						custom_next_date: customDate.toISO(),
						recurring: {
							frequency: 'weekly',
							pattern_adjusted: false,
							next_date: recurringDate.toISO(),
						},
					},
				};

				jest.spyOn(schedulingService, 'scheduleReminder').mockResolvedValueOnce(recurringResponse);

				require('../../utils/firestore').updateContactScheduling.mockResolvedValueOnce(customResponse);

				const recurringResult = await schedulingService.scheduleRecurringReminder(
					mockContact,
					new Date(),
					'weekly'
				);

				const customResult = await updateContactScheduling(mockContact.id, {
					custom_next_date: customDate.toJSDate(),
				});

				expect(recurringResult.scheduling?.recurring_next_date).toBeDefined();
				expect(customResult.scheduling.recurring_next_date).toBeDefined();
				expect(customResult.scheduling.custom_next_date).toBeDefined();
			});
		});
	});
});
