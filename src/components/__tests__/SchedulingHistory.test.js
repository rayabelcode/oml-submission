import { jest } from '@jest/globals';
import { DateTime } from 'luxon';
import { schedulingHistory } from '../../utils/scheduler/schedulingHistory';

// Suppress console.error
beforeAll(() => {
	jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
	jest.restoreAllMocks();
});

// Mock firebase
jest.mock('../../config/firebase', () => ({
	auth: {
		currentUser: { uid: 'test-user-id' },
	},
}));

// Mock cache manager
jest.mock('../../utils/cache', () => ({
	cacheManager: {
		getSchedulingHistory: jest.fn(),
		saveSchedulingHistory: jest.fn(),
	},
}));

// Mock notification coordinator
jest.mock('../../utils/notificationCoordinator', () => ({
	notificationCoordinator: {
		initialize: jest.fn(),
		scheduleNotification: jest.fn(),
		cancelNotification: jest.fn(),
	},
}));

describe('SchedulingHistory', () => {
	const mockContactId = 'test-contact';
	const mockTimestamp = DateTime.now();

	beforeEach(() => {
		jest.clearAllMocks();
		schedulingHistory.patternData = {
			timeSlots: {},
			daysOfWeek: {},
			snoozePatterns: [],
			skipPatterns: [],
			successfulAttempts: [],
			contactPatterns: {},
			lastUpdated: new Date().toISOString(),
		};
	});

	describe('Pattern Storage', () => {
		it('stores and analyzes rescheduling patterns', async () => {
			await schedulingHistory.storeReschedulingPattern(mockContactId, 'later_today', mockTimestamp, true);

			const patterns = await schedulingHistory.analyzeContactPatterns(mockContactId);
			expect(patterns.recentAttempts).toBe(1);
			expect(patterns.successRates.byHour).toBeDefined();
		});

		it('calculates success rates correctly', async () => {
			const baseTime = mockTimestamp.set({ hour: 14 }); // Set fixed hour for testing

			// Multiple patterns at the same hour
			for (let i = 0; i < 5; i++) {
				await schedulingHistory.storeReschedulingPattern(
					mockContactId,
					'tomorrow',
					baseTime, // Use same time for all attempts
					i % 2 === 0 // Alternate success/failure (3 successes, 2 failures)
				);
			}

			const patterns = await schedulingHistory.analyzeContactPatterns(mockContactId);
			expect(patterns.successRates.byHour['14']).toEqual({
				successRate: 0.6, // 3 successes out of 5 attempts
				attempts: 5,
			});
			expect(patterns.confidence).toBeGreaterThan(0);
		});

		it('handles pattern storage errors gracefully', async () => {
			jest.spyOn(schedulingHistory, 'savePatternData').mockRejectedValueOnce(new Error('Storage error'));

			await expect(
				schedulingHistory.storeReschedulingPattern(mockContactId, 'later_today', mockTimestamp, true)
			).rejects.toThrow('Storage error');
		});
	});

	describe('Time Slot Analysis', () => {
		beforeEach(async () => {
			// Initialize with minimal test data
			schedulingHistory.patternData = {
				timeSlots: {},
				daysOfWeek: {},
				snoozePatterns: [],
				skipPatterns: [],
				successfulAttempts: [],
				contactPatterns: {
					[mockContactId]: {
						attempts: [],
						aggregatedStats: {
							byHour: {},
							byDay: {},
							byType: {},
						},
					},
				},
				lastUpdated: new Date().toISOString(),
			};
		});

		it('identifies optimal time slots', async () => {
			// Set up test data for optimal time test
			await schedulingHistory.storeReschedulingPattern(
				mockContactId,
				'tomorrow',
				mockTimestamp.set({ hour: 14 }),
				true
			);
			await schedulingHistory.storeReschedulingPattern(
				mockContactId,
				'tomorrow',
				mockTimestamp.set({ hour: 14 }),
				true
			);

			const suggestion = await schedulingHistory.suggestOptimalTime(
				mockContactId,
				mockTimestamp.set({ hour: 9 }), // 9 AM
				'tomorrow'
			);

			expect(suggestion).toBeDefined();
			expect(suggestion.hour).toBe(14); // Should prefer 2 PM due to success rate
		});

		it('respects time window in analysis', async () => {
			// Clear any existing patterns
			schedulingHistory.patternData.contactPatterns[mockContactId].attempts = [];
			schedulingHistory.patternData.contactPatterns[mockContactId].aggregatedStats = {
				byHour: {},
				byDay: {},
				byType: {},
			};

			for (let i = 0; i < 3; i++) {
				await schedulingHistory.storeReschedulingPattern(
					mockContactId,
					'later_today',
					mockTimestamp.minus({ days: i }),
					true
				);
			}

			await schedulingHistory.storeReschedulingPattern(
				mockContactId,
				'later_today',
				mockTimestamp.minus({ days: 91 }),
				true
			);

			const patterns = await schedulingHistory.analyzeContactPatterns(mockContactId, 90);
			expect(patterns.recentAttempts).toBe(3);
		});
	});

	describe('Time Period Analysis', () => {
		it('correctly identifies time period preferences', async () => {
			// Test morning period
			await schedulingHistory.storeReschedulingPattern(
				mockContactId,
				'tomorrow',
				mockTimestamp.set({ hour: 9 }), // 9 AM
				true
			);

			// Test afternoon period
			await schedulingHistory.storeReschedulingPattern(
				mockContactId,
				'tomorrow',
				mockTimestamp.set({ hour: 14 }), // 2 PM
				true
			);

			await schedulingHistory.storeReschedulingPattern(
				mockContactId,
				'tomorrow',
				mockTimestamp.set({ hour: 15 }), // 3 PM
				true
			);

			// Test evening period
			await schedulingHistory.storeReschedulingPattern(
				mockContactId,
				'tomorrow',
				mockTimestamp.set({ hour: 19 }), // 7 PM
				true
			);

			const patterns = schedulingHistory.patternData.contactPatterns[mockContactId].attempts;
			const timePreferences = schedulingHistory.getTimePreference(patterns);

			expect(timePreferences).toEqual({
				morning: 1, // One attempt at 9 AM
				afternoon: 2, // Two attempts at 2 PM and 3 PM
				evening: 1, // One attempt at 7 PM
			});
		});

		it('handles empty patterns', () => {
			const timePreferences = schedulingHistory.getTimePreference([]);
			expect(timePreferences).toEqual({
				morning: 0,
				afternoon: 0,
				evening: 0,
			});
		});

		it('ignores attempts outside defined periods', async () => {
			// Attempt at 5 AM (outside defined periods)
			await schedulingHistory.storeReschedulingPattern(
				mockContactId,
				'tomorrow',
				mockTimestamp.set({ hour: 5 }),
				true
			);

			// Attempt at 23:00 (outside defined periods)
			await schedulingHistory.storeReschedulingPattern(
				mockContactId,
				'tomorrow',
				mockTimestamp.set({ hour: 23 }),
				true
			);

			const patterns = schedulingHistory.patternData.contactPatterns[mockContactId].attempts;
			const timePreferences = schedulingHistory.getTimePreference(patterns);

			expect(timePreferences).toEqual({
				morning: 0,
				afternoon: 0,
				evening: 0,
			});
		});
	});

	describe('Confidence Scoring', () => {
		it('calculates appropriate confidence scores', () => {
			const scenarios = [
				{
					attempts: 10,
					timeWindow: 30, // 10 attempts in 30 days
					expectedRange: { min: 0.6, max: 0.9 },
				},
				{
					attempts: 2,
					timeWindow: 90, // 2 attempts in 90 days
					expectedRange: { min: 0.1, max: 0.3 },
				},
				{
					attempts: 30,
					timeWindow: 90, // 30 attempts in 90 days
					expectedRange: { min: 0.7, max: 1.0 },
				},
			];

			scenarios.forEach(({ attempts, timeWindow, expectedRange }) => {
				const score = schedulingHistory.calculateConfidenceScore(attempts, timeWindow);
				expect(score).toBeGreaterThanOrEqual(expectedRange.min);
				expect(score).toBeLessThanOrEqual(expectedRange.max);
			});

			// Verify relative scoring
			const highFrequencyScore = schedulingHistory.calculateConfidenceScore(10, 30);
			const lowFrequencyScore = schedulingHistory.calculateConfidenceScore(2, 90);
			expect(highFrequencyScore).toBeGreaterThan(lowFrequencyScore);
		});

		it('handles edge cases appropriately', () => {
			// No attempts
			expect(schedulingHistory.calculateConfidenceScore(0, 30)).toBe(0);

			// Single attempt
			expect(schedulingHistory.calculateConfidenceScore(1, 30)).toBeLessThan(0.3);

			// Very high frequency
			expect(schedulingHistory.calculateConfidenceScore(100, 30)).toBeGreaterThan(0.85);
			expect(schedulingHistory.calculateConfidenceScore(100, 30)).toBeLessThanOrEqual(1);
		});
	});
});
