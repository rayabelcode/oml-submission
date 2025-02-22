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
						'You are an assistant helping maintain personal relationships. Generate conversation topics, flow, and appropriate humor based on contact details and history. Return response in valid JSON format only.',
				},
				{
					role: 'user',
					content: `Generate a conversation package for ${
						contact.first_name
					} in the following JSON format only:
					{
						"suggestions": ["topic 1", "topic 2", "topic 3"],
						"conversationFlow": [
							{"title": "Step 1", "description": "Description 1"},
							{"title": "Step 2", "description": "Description 2"}
						],
						"jokes": ["joke 1", "joke 2"],
						"keyMoments": ["moment 1", "moment 2"]
					}
					
					Use this contact info:
					Recent History: ${JSON.stringify(history.slice(-5))}
					Contact Details: ${JSON.stringify(contact)}
					${contact.birthday ? `Note: Contact's birthday is coming up on ${contact.birthday}` : ''}`,
				},
			],
			max_tokens: 500,
			temperature: 0.7,
		});

		const content = response.choices[0]?.message?.content || '';

		// Try to clean and parse the JSON
		const cleanedContent = content.trim().replace(/```json|```/g, '');

		try {
			return JSON.parse(cleanedContent);
		} catch (parseError) {
			console.error('JSON Parse error:', parseError);
			return {
				suggestions: ['Failed to parse AI response'],
				conversationFlow: [{ title: 'Error', description: 'Could not generate conversation flow' }],
				jokes: ['Technical difficulties with joke generation'],
				keyMoments: ['Unable to process key moments'],
			};
		}
	} catch (error) {
		console.error('AI generation error:', error);
		return {
			suggestions: ['Unable to generate suggestions'],
			conversationFlow: [{ title: 'Error', description: 'Could not connect to AI service' }],
			jokes: ['Technical difficulties with joke generation'],
			keyMoments: ['Unable to process key moments'],
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
