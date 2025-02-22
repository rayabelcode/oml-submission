import OpenAI from 'openai';
import { OPENAI_API_KEY } from '@env';

const openai = new OpenAI({
	apiKey: OPENAI_API_KEY,
	dangerouslyAllowBrowser: true,
});

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

// Generate comprehensive AI content
export const generateAIContent = async (contact, history) => {
	try {
		const response = await openai.chat.completions.create({
			model: 'gpt-3.5-turbo',
			messages: [
				{
					role: 'system',
					content:
						'You are an assistant helping maintain personal relationships. Generate conversation topics, flow, and appropriate humor based on contact details and history.',
				},
				{
					role: 'user',
					content: `Generate a comprehensive conversation package for ${contact.first_name}.
                    Recent History: ${JSON.stringify(history.slice(-5))}
                    Contact Details: ${JSON.stringify(contact)}
                    
                    Format as JSON with:
                    - suggestions: Array of conversation topics
                    - conversationFlow: Array of {title, description} steps
                    - jokes: Array of relevant jokes
                    - keyMoments: Array of follow-up points from history`,
				},
			],
			max_tokens: 500,
			temperature: 0.7,
		});

		return JSON.parse(response.choices[0]?.message?.content || '{}');
	} catch (error) {
		console.error('AI generation error:', error);
		return {
			suggestions: ['Unable to generate suggestions'],
			conversationFlow: [],
			jokes: [],
			keyMoments: [],
		};
	}
};

// Check for upcoming birthdays
export const checkUpcomingBirthday = (contact) => {
	if (!contact.birthday) return null;
	const today = new Date();
	const birthday = new Date(contact.birthday);
	birthday.setFullYear(today.getFullYear());

	if (birthday < today) {
		birthday.setFullYear(today.getFullYear() + 1);
	}

	const daysUntilBirthday = Math.ceil((birthday - today) / (1000 * 60 * 60 * 24));
	return daysUntilBirthday <= 30 ? birthday.toLocaleDateString() : null;
};
