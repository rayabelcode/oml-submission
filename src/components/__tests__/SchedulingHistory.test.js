import { jest } from '@jest/globals';
import { DateTime } from 'luxon';
import { schedulingHistory } from '../../utils/schedulingHistory';

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
			// Add multiple patterns
			for (let i = 0; i < 5; i++) {
				await schedulingHistory.storeReschedulingPattern(
					mockContactId,
					'tomorrow',
					mockTimestamp.plus({ hours: i }),
					i % 2 === 0 // Alternate success/failure
				);
			}

			const patterns = await schedulingHistory.analyzeContactPatterns(mockContactId);
			expect(patterns.successRates.byType.tomorrow.successRate).toBeCloseTo(0.6);
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

			// Add three patterns within the time window
			for (let i = 0; i < 3; i++) {
				await schedulingHistory.storeReschedulingPattern(
					mockContactId,
					'later_today',
					mockTimestamp.minus({ days: i }),
					true
				);
			}

			// Add one old pattern outside the window
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
