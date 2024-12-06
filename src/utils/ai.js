import { Configuration, OpenAIApi } from 'openai';
import { OPENAI_API_KEY } from '@env';

const configuration = new Configuration({
	apiKey: OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

/**
 * Generates topic suggestions based on the last 5 conversations.
 *
 * @param {Array} history - Array of conversation history objects.
 *        Each object should include a 'date' and 'notes'.
 * @returns {Promise<Array>} - An array of topics suggested by the AI model.
 */
export const generateTopicSuggestions = async (history) => {
	try {
		// Use only the last 5 entries in the history
		const recentHistory = history
			.slice(-5)
			.map(
				(entry, index) =>
					`Call ${index + 1} (${new Date(entry.date).toLocaleDateString()}): ${entry.notes}`
			)
			.join('\n');

		// Request suggestions from the OpenAI API
		const response = await openai.createChatCompletion({
			model: 'gpt-3.5-turbo',
			messages: [
				{
					role: 'system',
					content:
						'You are an assistant helping with relationship management. Based on call history, generate a list of topics for discussion in the next call.',
				},
				{
					role: 'user',
					content: `Here is the recent call history:\n\n${recentHistory}\n\nWhat topics should we discuss next?`,
				},
			],
			max_tokens: 150, // Limit the number of tokens to keep responses concise
		});

		// Extract AI-generated suggestions from the response
		const suggestions = response.data.choices[0]?.message?.content || 'No suggestions available.';
		return suggestions
			.split('\n') // Split into individual lines
			.map((topic) => topic.trim()) // Trim whitespace
			.filter(Boolean); // Remove empty lines
	} catch (error) {
		console.error('Error generating topic suggestions:', error);
		throw new Error('Failed to generate suggestions.');
	}
};
