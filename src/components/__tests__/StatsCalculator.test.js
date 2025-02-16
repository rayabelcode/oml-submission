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

	describe('Needs Attention Calculation', () => {
		it('suggests contacts based on frequency settings', async () => {
			const mockUpcomingContacts = [
				{
					id: '1',
					first_name: 'Weekly',
					last_name: 'Contact',
					scheduling: { frequency: 'weekly' },
					contact_history: [
						{ date: new Date(mockDate.getTime() - 10 * 86400000).toISOString() }, // 10 days ago
					],
				},
				{
					id: '2',
					first_name: 'Monthly',
					last_name: 'Contact',
					scheduling: { frequency: 'monthly' },
					contact_history: [
						{ date: new Date(mockDate.getTime() - 20 * 86400000).toISOString() }, // 20 days ago
					],
				},
				{
					id: '3',
					first_name: 'Quarterly',
					last_name: 'Contact',
					scheduling: { frequency: 'quarterly' },
					contact_history: [
						{ date: new Date(mockDate.getTime() - 100 * 86400000).toISOString() }, // 100 days ago
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

			expect(stats.detailed.needsAttention).toHaveLength(2); // Weekly and Quarterly contacts should need attention
			expect(stats.detailed.needsAttention[0].name).toBe('Quarterly Contact'); // Most overdue relative to frequency should be first
			expect(stats.detailed.needsAttention[1].name).toBe('Weekly Contact'); // Second most overdue
			expect(stats.detailed.needsAttention.map((contact) => contact.name)).not.toContain('Monthly Contact'); // Monthly contact shouldn't need attention yet
		});

		it('limits suggestions to 3 contacts maximum', async () => {
			const mockUpcomingContacts = Array.from({ length: 5 }, (_, i) => ({
				id: `${i}`,
				first_name: `Contact`,
				last_name: `${i}`,
				scheduling: { frequency: 'weekly' },
				contact_history: [
					{ date: new Date(mockDate.getTime() - (10 + i) * 86400000).toISOString() }, // Each progressively more overdue
				],
			}));

			const mockAllContacts = {
				scheduledContacts: mockUpcomingContacts,
				unscheduledContacts: [],
			};

			fetchContacts.mockResolvedValue(mockAllContacts);
			fetchUpcomingContacts.mockResolvedValue(mockUpcomingContacts);

			const stats = await calculateStats(mockUserId);

			expect(stats.detailed.needsAttention).toHaveLength(3);
			// Should contain the 3 most overdue contacts
			expect(stats.detailed.needsAttention[0].name).toBe('Contact 4');
			expect(stats.detailed.needsAttention[1].name).toBe('Contact 3');
			expect(stats.detailed.needsAttention[2].name).toBe('Contact 2');
		});
	});
});
