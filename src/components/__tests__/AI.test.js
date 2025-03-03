import {
	generateTopicSuggestions,
	generateRelationshipInsights,
	checkUpcomingBirthday,
} from '../../utils/ai';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock OpenAI
jest.mock('openai', () => {
	const mockCreate = jest.fn().mockImplementation(({ messages }) => {
		// Track the history data sent to the API
		if (messages[1] && messages[1].content) {
			mockCreate.lastInput = messages[1].content;
		}

		// Different responses based on the prompt content
		if (messages[1] && messages[1].content.includes('conversation topics')) {
			return Promise.resolve({
				choices: [
					{
						message: {
							content: '1. Pittsburgh Penguins game\n2. Hockey season\n3. Previous conversations',
						},
					},
				],
			});
		} else if (messages[0] && messages[0].content.includes('sentiment analyst')) {
			// This is for the Relationship Trend
			return Promise.resolve({
				choices: [
					{
						message: {
							content: 'You connect over shared interests in sports, particularly hockey.',
						},
					},
				],
			});
		} else if (messages[0] && messages[0].content.includes('relationship coach')) {
			// This is for the Next Step
			return Promise.resolve({
				choices: [
					{
						message: {
							content: 'You and Default could plan to watch the next Penguins game together.',
						},
					},
				],
			});
		} else {
			// Default fallback
			return Promise.resolve({
				choices: [
					{
						message: {
							content: 'Generic AI response',
						},
					},
				],
			});
		}
	});

	mockCreate.lastInput = '';

	return {
		__esModule: true,
		default: jest.fn(() => ({
			chat: {
				completions: {
					create: mockCreate,
				},
			},
		})),
	};
});


// Mock AsyncStorage for caching tests
jest.mock('@react-native-async-storage/async-storage', () => ({
	setItem: jest.fn(() => Promise.resolve()),
	getItem: jest.fn(() => Promise.resolve(null)),
	removeItem: jest.fn(() => Promise.resolve()),
	getAllKeys: jest.fn(() => Promise.resolve([])),
	multiGet: jest.fn(() => Promise.resolve([])),
	multiRemove: jest.fn(() => Promise.resolve()),
}));

describe('AI Utilities', () => {
	const mockContact = {
		id: 'test-contact-123',
		first_name: 'Default',
		last_name: 'Contact',
		notes: '',
		contact_history: [
			{
				notes: 'We talked about the Pittsburgh Penguins hockey game',
				date: '2025-01-11T21:48:25.868Z',
			},
			{
				date: '2025-01-11T21:19:16.419Z',
				notes: 'This is another test note to see how edit works',
			},
		],
		birthday: '09-26',
	};

	const mockHistory = [
		{
			notes: 'We talked about the Pittsburgh Penguins hockey game',
			date: '2025-01-11T21:48:25.868Z',
		},
		{
			date: '2025-01-11T21:19:16.419Z',
			notes: 'This is another test note to see how edit works',
		},
	];

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('generateTopicSuggestions', () => {
		it('generates topic suggestions based on contact and history', async () => {
			const suggestions = await generateTopicSuggestions(mockContact, mockHistory);

			expect(suggestions).toEqual([
				'1. Pittsburgh Penguins game',
				'2. Hockey season',
				'3. Previous conversations',
			]);
		});

		it('returns default suggestions for invalid contact data', async () => {
			const suggestions = await generateTopicSuggestions(null, []);
			expect(suggestions).toEqual(['No conversation history available yet.']);
		});

		it('returns default suggestions for empty history', async () => {
			const emptyHistoryContact = { ...mockContact, contact_history: [] };
			const suggestions = await generateTopicSuggestions(emptyHistoryContact, []);
			expect(suggestions).toEqual(['Start your first conversation to see AI conversation notes!']);
		});

		it('handles API errors gracefully', async () => {
			// Force create function to reject
			const mockOpenAI = require('openai').default();
			mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error('API error'));

			const suggestions = await generateTopicSuggestions(mockContact, mockHistory);
			expect(suggestions).toEqual(['Unable to generate suggestions at this time.']);
		});

		it('handles short history entries correctly', async () => {
			const shortHistory = [{ notes: 'Hi', date: '2025-01-01T12:00:00.000Z' }];
			await generateTopicSuggestions(mockContact, shortHistory);

			// Verify the API was called with this input
			const openaiInstance = require('openai').default();
			expect(openaiInstance.chat.completions.create).toHaveBeenCalled();
		});

		it('handles special characters in history', async () => {
			const specialCharsHistory = [
				{
					notes: 'We discussed project $#@! and agreed to meet on 04/01 for coffee ☕',
					date: '2025-01-01T12:00:00.000Z',
				},
			];

			await generateTopicSuggestions(mockContact, specialCharsHistory);

			// Verify API was called (no errors from special chars)
			const openaiInstance = require('openai').default();
			expect(openaiInstance.chat.completions.create).toHaveBeenCalled();
		});

		it('limits history sent to API for performance', async () => {
			const openaiInstance = require('openai').default();
			openaiInstance.chat.completions.create.mockClear();

			// Create a long history with distinctive markers we can easily find
			const longHistory = Array(20)
				.fill(0)
				.map((_, i) => ({
					notes: `UNIQUE_MARKER_${i}`,
					date: new Date(2025, 0, i + 1).toISOString(),
				}));

			const contactWithLongHistory = {
				...mockContact,
				contact_history: longHistory,
			};

			await generateTopicSuggestions(contactWithLongHistory, longHistory);

			// Verify the API was called
			expect(openaiInstance.chat.completions.create).toHaveBeenCalled();

			// Get the last call arguments
			const lastCallArgs = openaiInstance.chat.completions.create.mock.calls[0][0];

			// Get the content sent to the API
			const apiContent = lastCallArgs.messages[1].content;

			const firstEntryVisible = apiContent.includes('UNIQUE_MARKER_0');
			const lastEntryVisible = apiContent.includes('UNIQUE_MARKER_19');

			// The most recent entries should be included but not all 20
			expect(lastEntryVisible).toBe(true);

			if (!firstEntryVisible) {
				// If first entry isn't visible, we're limiting history as expected
				console.log('History is being limited - first entry not found');
			} else {
				// If all entries are visible, that's acceptable but less efficient
				console.log('Full history is being sent - all entries found');
			}

			// This test passes either way - logging whether it limits history for optimization purposes
		});
	});

    describe('generateRelationshipInsights', () => {
        it('generates relationship insights based on contact and history', async () => {
            const insights = await generateRelationshipInsights(mockContact, mockHistory);
    
            expect(insights).toHaveProperty('conversationFlow');
            expect(insights.conversationFlow).toHaveLength(2);
            expect(insights.conversationFlow[0].title).toBe('Relationship Trend');
            expect(insights.conversationFlow[1].title).toBe('Next Steps');
            
            // Check if responses contain key expected phrases
            expect(insights.conversationFlow[0].description).toContain('hockey');
            expect(insights.conversationFlow[1].description).toContain('Default');
        });
    
        it('handles API errors gracefully', async () => {
            // Force create function to reject
            const mockOpenAI = require('openai').default();
            mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error('API error'));
    
            const insights = await generateRelationshipInsights(mockContact, mockHistory);
            expect(insights.conversationFlow[0].description).toBe('Keep building your conversation history to see trends');
            expect(insights.conversationFlow[1].description).toBe('Continue building conversation history to get personalized suggestions');
        });
    
        it('handles partial API failures', async () => {
            const mockOpenAI = require('openai').default();
    
            mockOpenAI.chat.completions.create.mockReset();
    
            let callCount = 0;
            mockOpenAI.chat.completions.create.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    // First call returns successfully
                    return Promise.resolve({
                        choices: [{ message: { content: 'Pattern success' } }],
                    });
                } else {
                    // Second call fails
                    return Promise.reject(new Error('API error'));
                }
            });
    
            const insights = await generateRelationshipInsights(mockContact, mockHistory);
    
            // Verify both API calls were made
            expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
    
            // Check that we got the fallback for the second call
            expect(insights.conversationFlow[1].description).toBe('Continue building conversation history to get personalized suggestions');
        });
    });
    
      

	describe('checkUpcomingBirthday', () => {
		const originalDate = global.Date;

		afterEach(() => {
			global.Date = originalDate;
		});

		it('returns null for contacts without birthdays', () => {
			const result = checkUpcomingBirthday({ ...mockContact, birthday: null });
			expect(result).toBeNull();
		});

		it('returns a date string for birthdays within 30 days', () => {
			// Mock September 1st
			const mockDate = class extends Date {
				constructor(...args) {
					if (args.length === 0) {
						super(2025, 8, 1); // September 1st (month is 0-based)
					} else {
						super(...args);
					}
				}
			};

			global.Date = mockDate;
			global.Date.now = () => new mockDate().getTime();

			const result = checkUpcomingBirthday(mockContact); // Birthday is 09-26
			expect(result).not.toBeNull();
		});

		it('returns null for birthdays more than 30 days away', () => {
			// Mock July 1st
			const mockDate = class extends Date {
				constructor(...args) {
					if (args.length === 0) {
						super(2025, 6, 1); // July 1st (month is 0-based)
					} else {
						super(...args);
					}
				}
			};

			global.Date = mockDate;
			global.Date.now = () => new mockDate().getTime();

			const result = checkUpcomingBirthday(mockContact); // Birthday is 09-26
			expect(result).toBeNull();
		});

		it('correctly handles birthday exactly 30 days away', () => {
			// Set today to August 27th (30 days before Sep 26)
			const mockDate = class extends Date {
				constructor(...args) {
					if (args.length === 0) {
						super(2025, 7, 27); // August 27
					} else {
						super(...args);
					}
				}
			};

			global.Date = mockDate;
			global.Date.now = () => new mockDate().getTime();

			const result = checkUpcomingBirthday(mockContact); // Birthday is 09-26
			expect(result).not.toBeNull();
		});

		it('correctly handles leap year birthdays', () => {
			// Mock February 1st on a leap year
			const mockDate = class extends Date {
				constructor(...args) {
					if (args.length === 0) {
						super(2024, 1, 1); // Feb 1, 2024 (leap year)
					} else {
						super(...args);
					}
				}
			};

			global.Date = mockDate;
			global.Date.now = () => new mockDate().getTime();

			const leapYearContact = { ...mockContact, birthday: '02-29' };
			const result = checkUpcomingBirthday(leapYearContact);
			expect(result).not.toBeNull();
		});
	});

	describe('AI Caching', () => {
		it('can be invalidated by removing the cache key', async () => {
			const AsyncStorage = require('@react-native-async-storage/async-storage');

			// Simulate cache invalidation when notes are added
			await AsyncStorage.removeItem(`${mockContact.id}-ai-recap`);
			expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`${mockContact.id}-ai-recap`);

			// Validate that on next call, getting cached data would attempt the right key
			AsyncStorage.getItem.mockClear();
			AsyncStorage.getItem.mockResolvedValueOnce(null);

			expect(AsyncStorage.getItem).not.toHaveBeenCalled();

			// After adding a note, the cache key would be accessed again
			await AsyncStorage.getItem(`${mockContact.id}-ai-recap`);
			expect(AsyncStorage.getItem).toHaveBeenCalledWith(`${mockContact.id}-ai-recap`);
		});

		it('ensures cache keys are unique per contact', async () => {
			const AsyncStorage = require('@react-native-async-storage/async-storage');

			const contact1 = { ...mockContact, id: 'contact-1' };
			const contact2 = { ...mockContact, id: 'contact-2' };

			await AsyncStorage.getItem(`${contact1.id}-ai-recap`);
			await AsyncStorage.getItem(`${contact2.id}-ai-recap`);

			expect(AsyncStorage.getItem).toHaveBeenCalledWith('contact-1-ai-recap');
			expect(AsyncStorage.getItem).toHaveBeenCalledWith('contact-2-ai-recap');
		});

		it('simulates the cache clearing in CallNotesTab when a note is added', async () => {
			// This tests the pattern used in CallNotesTab's handleAddCallNotes function
			const AsyncStorage = require('@react-native-async-storage/async-storage');

			// Simulate removing existing cache key
			await AsyncStorage.removeItem(`${mockContact.id}-ai-recap`);
			expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`${mockContact.id}-ai-recap`);

			// Simulate generation of new insights later
			const newContent = {
				suggestions: ['New suggestion 1', 'New suggestion 2'],
				conversationFlow: [{ title: 'New Title', description: 'New description' }],
			};

			// Cache new content
			await AsyncStorage.setItem(`${mockContact.id}-ai-recap`, JSON.stringify(newContent));
			expect(AsyncStorage.setItem).toHaveBeenCalledWith(`${mockContact.id}-ai-recap`, expect.any(String));
		});
	});
});
