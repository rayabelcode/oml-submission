import OpenAI from 'openai';
import { OPENAI_API_KEY } from '@env';

const openai = new OpenAI({
	apiKey: OPENAI_API_KEY,
	dangerouslyAllowBrowser: true,
});

// Main tab conversation suggestions
export const generateTopicSuggestions = async (contact, history) => {
	try {
		// Verify we have valid contact data
		if (!contact || !contact.contact_history) {
			return ['No conversation history available yet.'];
		}

		// Create full name from first_name and last_name
		const contactName = `${contact.first_name} ${contact.last_name || ''}`.trim();

		const recentHistory = (contact.contact_history || [])
			.slice(-5)
			.map(
				(entry, index) => `Call ${index + 1} (${new Date(entry.date).toLocaleDateString()}): ${entry.notes}`
			)
			.join('\n');

		if (!recentHistory) {
			return ['Start your first conversation!'];
		}

		const response = await openai.chat.completions.create({
			model: 'gpt-3.5-turbo',
			messages: [
				{
					role: 'system',
					content:
						'You are an assistant helping maintain personal relationships. Generate specific conversation topics based on contact details and history.',
				},
				{
					role: 'user',
					content: `I need conversation topics for my contact ${contactName}.
            
					Contact Information:
					Name: ${contactName}
					Contact Notes: ${contact.notes || 'No additional notes'}
					${contact.birthday ? `Birthday: ${contact.birthday}` : ''}
					
					Recent Conversation History:
					${recentHistory}
					
					Based on this specific contact's information and conversation history, suggest 3-5 personalized topics for our next conversation.`,
				},
			],
			max_tokens: 150,
			temperature: 0.7,
		});

		const suggestions = response.choices[0]?.message?.content || 'No suggestions available.';
		return suggestions
			.split('\n')
			.map((topic) => topic.trim())
			.filter(Boolean);
	} catch (error) {
		console.error('Error generating topic suggestions:', error);
		return ['Unable to generate suggestions at this time.'];
	}
};

const getRelationshipPattern = async (contact, history) => {
	const response = await openai.chat.completions.create({
		model: 'gpt-3.5-turbo',
		messages: [
			{
				role: 'system',
				content: 'Provide a brief, friendly observation about their relationship dynamic.',
			},
			{
				role: 'user',
				content: `What's notable about my connection with ${
					contact.first_name
				}? Keep it brief. Recent History: ${JSON.stringify(history.slice(-5))}`,
			},
		],
		max_tokens: 50,
		temperature: 0.7,
	});
	return response.choices[0]?.message?.content?.trim() || 'Unable to analyze pattern';
};

const getNextSteps = async (contact, history) => {
	const response = await openai.chat.completions.create({
		model: 'gpt-3.5-turbo',
		messages: [
			{
				role: 'system',
				content: 'Provide a brief, friendly suggestion to enhance their connection.',
			},
			{
				role: 'user',
				content: `Give a quick suggestion to strengthen my connection with ${
					contact.first_name
				}. Recent History: ${JSON.stringify(history.slice(-5))}`,
			},
		],
		max_tokens: 50,
		temperature: 0.7,
	});
	return response.choices[0]?.message?.content?.trim() || 'Continue building conversation history';
};

const getJoke = async (contact, history) => {
	const response = await openai.chat.completions.create({
		model: 'gpt-3.5-turbo',
		messages: [
			{
				role: 'system',
				content:
					'You are a friendly dad-joke expert. Provide a short, clean, actually funny dad joke or pun.',
			},
			{
				role: 'user',
				content: `Share a funny dad joke that ${
					contact.first_name
				} might enjoy. Use their interests as inspiration but the joke doesn't need to directly reference them: ${JSON.stringify(
					history.slice(-5)
				)}`,
			},
		],
		max_tokens: 100,
		temperature: 0.9,
	});
	return response.choices[0]?.message?.content?.trim() || 'Unable to generate joke';
};

// Generate relationship insights based on contact and history
export const generateRelationshipInsights = async (contact, history) => {
	try {
		const [pattern, nextSteps, joke] = await Promise.all([
			getRelationshipPattern(contact, history),
			getNextSteps(contact, history),
			getJoke(contact, history),
		]);

		return {
			conversationFlow: [
				{
					title: 'Relationship Pattern',
					description: pattern,
				},
				{
					title: 'Next Steps',
					description: nextSteps,
				},
			],
			jokes: [joke],
		};
	} catch (error) {
		console.error('Error in generateRelationshipInsights:', error);
		return {
			conversationFlow: [
				{
					title: 'Relationship Pattern',
					description: 'Not enough history to analyze patterns',
				},
				{
					title: 'Next Steps',
					description: 'Continue building conversation history',
				},
			],
			jokes: ['Need more conversations to generate relevant jokes'],
		};
	}
};

// Check for upcoming birthdays within 30 days
export const checkUpcomingBirthday = (contact) => {
	if (!contact.birthday) return null;

	// Parse MM-DD format
	const [month, day] = contact.birthday.split('-').map((num) => parseInt(num, 10));
	const today = new Date();
	const birthday = new Date(today.getFullYear(), month - 1, day); // month is 0-based

	// If birthday has passed this year, look at next year's date
	if (birthday < today) {
		birthday.setFullYear(today.getFullYear() + 1);
	}

	const daysUntilBirthday = Math.ceil((birthday - today) / (1000 * 60 * 60 * 24));

	// Only return the date if birthday is within next 30 days
	return daysUntilBirthday <= 30 ? birthday.toLocaleDateString() : null;
};
