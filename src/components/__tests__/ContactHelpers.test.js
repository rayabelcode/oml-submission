import { createContactData, updateContactData, SCHEDULING_CONSTANTS } from '../../utils/contactHelpers';
import { formatBirthday } from '../../utils/dateHelpers';
import {
	RELATIONSHIP_TYPES,
	RELATIONSHIP_DEFAULTS,
	DEFAULT_RELATIONSHIP_TYPE,
} from '../../../constants/relationships';

// Silence console.errors for clean output
beforeEach(() => {
	jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	jest.restoreAllMocks();
});

jest.mock('firebase/firestore', () => ({
	serverTimestamp: () => ({
		_seconds: Math.floor(Date.now() / 1000),
		_nanoseconds: (Date.now() % 1000) * 1000000,
	}),
}));

jest.mock('../../utils/dateHelpers', () => ({
	formatBirthday: jest.fn((date) => {
		if (!date) return null;
		return '01-01'; // Mock return
	}),
}));

jest.mock('../../../constants/relationships', () => ({
	RELATIONSHIP_TYPES: {
		friend: 'Friend',
		family: 'Family',
		work: 'Work',
	},
	RELATIONSHIP_DEFAULTS: {
		preferred_days: {
			friend: ['monday', 'wednesday', 'friday'],
			family: ['saturday', 'sunday'],
			work: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
		},
		active_hours: {
			friend: { start: '09:00', end: '17:00' },
			family: { start: '10:00', end: '20:00' },
			work: { start: '09:00', end: '17:00' },
		},
		excluded_times: {
			friend: [],
			family: [],
			work: [],
		},
	},
	DEFAULT_RELATIONSHIP_TYPE: 'friend',
}));

describe('contactHelpers', () => {
	describe('createContactData', () => {
		const basicData = {
			first_name: 'John',
			last_name: 'Doe',
			phone: '1234567890',
			email: 'john@example.com',
		};

		it('creates contact with minimum required fields', () => {
			const result = createContactData(basicData, 'test-user');
			expect(result).toMatchObject({
				first_name: 'John',
				last_name: 'Doe',
				phone: '+11234567890',
				email: 'john@example.com',
				user_id: 'test-user',
			});
		});

		it('standardizes phone numbers correctly', () => {
			const testCases = [
				{ input: '1234567890', expected: '+11234567890' },
				{ input: '11234567890', expected: '+11234567890' },
				{ input: '+11234567890', expected: '+11234567890' },
				{ input: '441234567890', expected: '+441234567890' },
			];

			testCases.forEach(({ input, expected }) => {
				const data = { ...basicData, phone: input };
				const result = createContactData(data, 'test-user');
				expect(result.phone).toBe(expected);
			});
		});

		it('handles relationship type defaults', () => {
			const result = createContactData(basicData, 'test-user');
			expect(result.scheduling.relationship_type).toBe(DEFAULT_RELATIONSHIP_TYPE);
			expect(result.scheduling.custom_preferences).toEqual({
				preferred_days: RELATIONSHIP_DEFAULTS.preferred_days[DEFAULT_RELATIONSHIP_TYPE],
				active_hours: RELATIONSHIP_DEFAULTS.active_hours[DEFAULT_RELATIONSHIP_TYPE],
				excluded_times: RELATIONSHIP_DEFAULTS.excluded_times[DEFAULT_RELATIONSHIP_TYPE],
			});
		});

		it('handles custom relationship type', () => {
			const dataWithType = { ...basicData, relationship_type: 'work' };
			const result = createContactData(dataWithType, 'test-user');
			expect(result.scheduling.relationship_type).toBe('work');
			expect(result.scheduling.custom_preferences).toEqual({
				preferred_days: RELATIONSHIP_DEFAULTS.preferred_days.work,
				active_hours: RELATIONSHIP_DEFAULTS.active_hours.work,
				excluded_times: RELATIONSHIP_DEFAULTS.excluded_times.work,
			});
		});

		it('sets correct default scheduling values', () => {
			const result = createContactData(basicData, 'test-user');
			expect(result.scheduling).toMatchObject({
				frequency: null,
				custom_schedule: true,
				priority: SCHEDULING_CONSTANTS.PRIORITIES.NORMAL,
				minimum_gap: 30,
				pattern_adjusted: false,
				confidence: null,
				snooze_count: { increment: 0 },
				scheduling_status: {
					wasRescheduled: false,
					wasSnooze: false,
				},
			});
		});

		it('handles birthday formatting', () => {
			const dataWithBirthday = { ...basicData, birthday: '2000-01-01' };
			const result = createContactData(dataWithBirthday, 'test-user');
			expect(formatBirthday).toHaveBeenCalledWith('2000-01-01');
			expect(result.birthday).toBe('01-01');
		});

		it('handles birthday formatting errors gracefully', () => {
			formatBirthday.mockImplementationOnce(() => {
				throw new Error('Invalid date');
			});
			const dataWithInvalidBirthday = { ...basicData, birthday: 'invalid' };
			const result = createContactData(dataWithInvalidBirthday, 'test-user');
			expect(result.birthday).toBeNull();
		});
	});

	describe('updateContactData', () => {
		it('standardizes scheduling data structure', () => {
			const updates = {
				scheduling: {
					snooze_count: 1,
					recurring_next_date: new Date('2024-01-01'),
					custom_next_date: new Date('2024-02-01'),
				},
			};

			const result = updateContactData(updates);

			expect(result.scheduling).toMatchObject({
				snooze_count: { increment: 1 },
				recurring_next_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
				custom_next_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
			});
		});

		it('handles missing scheduling_status', () => {
			const updates = {
				scheduling: {
					snooze_count: { increment: 1 },
				},
			};

			const result = updateContactData(updates);
			expect(result.scheduling.scheduling_status).toEqual({
				wasRescheduled: false,
				wasSnooze: false,
			});
		});

		it('handles relationship type updates', () => {
			const updates = {
				relationship_type: 'work',
				scheduling: {},
			};

			const result = updateContactData(updates);
			expect(result.relationship_type).toBeUndefined();
			expect(result.scheduling.relationship_type).toBe('work');
		});

		it('standardizes phone numbers in updates', () => {
			const updates = {
				phone: '1234567890',
			};

			const result = updateContactData(updates);
			expect(result.phone).toBe('+11234567890');
		});

		it('converts dates to ISO strings', () => {
			const testDate = new Date('2024-01-01T12:00:00Z');
			const testTimestamp = { seconds: Math.floor(testDate.getTime() / 1000), nanoseconds: 0 };
			const testIsoString = testDate.toISOString();

			const updates = {
				next_contact: testDate,
				scheduling: {
					recurring_next_date: testTimestamp,
					custom_next_date: testIsoString,
				},
			};

			const result = updateContactData(updates);
			const expectedISOString = testDate.toISOString();

			expect(result.next_contact).toBe(expectedISOString);
			expect(result.scheduling.recurring_next_date).toBe(expectedISOString);
			expect(result.scheduling.custom_next_date).toBe(testIsoString); // Already ISO, should remain unchanged
		});

		it('removes updated_at from updates', () => {
			const updates = {
				updated_at: new Date(),
				first_name: 'John',
			};

			const result = updateContactData(updates);
			expect(result.updated_at).toBeUndefined();
			expect(result.last_updated).toBeDefined();
		});

		it('handles error cases', () => {
			expect(() => updateContactData(null)).toThrow('Failed to update contact data');
			expect(() => updateContactData(undefined)).toThrow('Failed to update contact data');
		});
		it('handles date format conversion correctly', () => {
			// Test 1: Handles already ISO-formatted strings
			const isoStringUpdates = {
				next_contact: '2024-01-01T12:00:00.000Z',
				scheduling: {
					recurring_next_date: '2024-01-02T12:00:00.000Z',
					custom_next_date: '2024-01-03T12:00:00.000Z',
				},
			};

			const isoResult = updateContactData(isoStringUpdates);
			expect(isoResult.next_contact).toBe('2024-01-01T12:00:00.000Z');
			expect(isoResult.scheduling.recurring_next_date).toBe('2024-01-02T12:00:00.000Z');
			expect(isoResult.scheduling.custom_next_date).toBe('2024-01-03T12:00:00.000Z');

			// Test 2: Handles JavaScript Date objects
			const jsDateUpdates = {
				next_contact: new Date('2024-01-01T12:00:00Z'),
				scheduling: {
					recurring_next_date: new Date('2024-01-02T12:00:00Z'),
					custom_next_date: new Date('2024-01-03T12:00:00Z'),
				},
			};

			const jsDateResult = updateContactData(jsDateUpdates);
			expect(jsDateResult.next_contact).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
			expect(jsDateResult.scheduling.recurring_next_date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
			expect(jsDateResult.scheduling.custom_next_date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

			// Test 3: Handles Firestore timestamps
			const firestoreTimestampUpdates = {
				next_contact: { seconds: 1704110400, nanoseconds: 0 }, // 2024-01-01T12:00:00Z
				scheduling: {
					recurring_next_date: { seconds: 1704196800, nanoseconds: 0 }, // 2024-01-02T12:00:00Z
					custom_next_date: { seconds: 1704283200, nanoseconds: 0 }, // 2024-01-03T12:00:00Z
				},
			};

			const timestampResult = updateContactData(firestoreTimestampUpdates);
			expect(timestampResult.next_contact).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
			expect(timestampResult.scheduling.recurring_next_date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
			expect(timestampResult.scheduling.custom_next_date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		});

		it('handles edge cases in date conversion', () => {
			// Partially defined scheduling with only some date fields
			const partialUpdates = {
				scheduling: {
					recurring_next_date: new Date('2024-01-01T12:00:00Z'),
					// No custom_next_date
				},
			};

			const partialResult = updateContactData(partialUpdates);
			expect(partialResult.scheduling.recurring_next_date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
			expect(partialResult.scheduling.custom_next_date).toBeUndefined();

			// Empty scheduling object
			const emptySchedulingUpdates = {
				scheduling: {},
			};

			const emptyResult = updateContactData(emptySchedulingUpdates);
			expect(emptyResult.scheduling).toEqual({
				scheduling_status: { wasRescheduled: false, wasSnooze: false },
			});
		});
	});
});
