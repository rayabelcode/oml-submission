import { jest } from '@jest/globals';
import { calculateStats } from '../../../src/screens/stats/statsCalculator';
import { fetchUpcomingContacts, fetchContacts } from '../../../src/utils/firestore';
import { RELATIONSHIP_TYPES } from '../../../constants/relationships';

// Mock the firestore functions
jest.mock('../../../src/utils/firestore', () => ({
	fetchUpcomingContacts: jest.fn(),
	fetchContacts: jest.fn(),
}));

describe('statsCalculator', () => {
	const mockUserId = 'test-user-id';
	const mockDate = new Date('2024-01-15T12:00:00Z');

	beforeAll(() => {
		// Mock Date.now() for consistent testing
		jest.useFakeTimers();
		jest.setSystemTime(mockDate);
		// Suppress console.error messages
		jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterAll(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('Distribution Calculation', () => {
		it('calculates correct distribution for all contacts', async () => {
			const mockAllContacts = {
				scheduledContacts: [
					{
						id: '1',
						first_name: 'John',
						last_name: 'Doe',
						relationship_type: 'family',
						scheduling: { relationship_type: 'family' },
					},
					{
						id: '2',
						first_name: 'Jane',
						last_name: 'Smith',
						relationship_type: 'friend',
						scheduling: { relationship_type: 'friend' },
					},
				],
				unscheduledContacts: [
					{
						id: '3',
						first_name: 'Bob',
						last_name: 'Work',
						relationship_type: 'work',
						scheduling: null,
					},
				],
			};

			fetchContacts.mockResolvedValue(mockAllContacts);
			fetchUpcomingContacts.mockResolvedValue(mockAllContacts.scheduledContacts);

			const stats = await calculateStats(mockUserId);

			expect(stats.distribution).toHaveLength(Object.keys(RELATIONSHIP_TYPES).length);
			expect(stats.distribution.find((d) => d.type === 'family')).toEqual({
				type: 'family',
				count: 1,
				percentage: 33,
				color: RELATIONSHIP_TYPES.family.color,
				icon: RELATIONSHIP_TYPES.family.icon,
			});
		});

		it('handles contacts with different scheduling and direct relationship types', async () => {
			const mockAllContacts = {
				scheduledContacts: [
					{
						id: '1',
						first_name: 'John',
						last_name: 'Doe',
						relationship_type: 'family',
						scheduling: { relationship_type: 'friend' },
					},
				],
				unscheduledContacts: [],
			};

			fetchContacts.mockResolvedValue(mockAllContacts);
			fetchUpcomingContacts.mockResolvedValue([mockAllContacts.scheduledContacts[0]]);

			const stats = await calculateStats(mockUserId);

			expect(stats.distribution.find((d) => d.type === 'family').count).toBe(1);
			expect(stats.distribution.find((d) => d.type === 'friend').count).toBe(1);
		});
	});

	describe('Basic Stats Calculation', () => {
		it('calculates correct basic stats for upcoming contacts', async () => {
			const mockUpcomingContacts = [
				{
					id: '1',
					first_name: 'John',
					last_name: 'Doe',
					contact_history: [
						{ date: mockDate.toISOString() },
						{ date: new Date(mockDate.getTime() - 86400000).toISOString() },
					],
				},
			];

			const mockAllContacts = {
				scheduledContacts: mockUpcomingContacts,
				unscheduledContacts: [],
			};

			fetchContacts.mockResolvedValue(mockAllContacts);
			fetchUpcomingContacts.mockResolvedValue(mockUpcomingContacts);

			const stats = await calculateStats(mockUserId);

			expect(stats.basic).toEqual({
				totalActive: 1,
				unscheduled: 1,
			});
		});
	});

	describe('Error Handling', () => {
		it('returns default stats when userId is missing', async () => {
			const stats = await calculateStats(null);
			expect(stats).toEqual({
				basic: {
					totalActive: 0,
					unscheduled: 0,
				},
				detailed: {
					needsAttention: [],
					mostActiveDay: 0,
				},
				distribution: [],
				trends: {
					ninetyDayTrend: 0,
				},
			});
		});

		it('handles API errors gracefully', async () => {
			fetchContacts.mockRejectedValue(new Error('API Error'));
			fetchUpcomingContacts.mockRejectedValue(new Error('API Error'));

			const stats = await calculateStats(mockUserId);
			expect(stats).toEqual(
				expect.objectContaining({
					basic: expect.any(Object),
					detailed: expect.any(Object),
					distribution: expect.any(Array),
					trends: expect.any(Object),
				})
			);
		});
	});
});
