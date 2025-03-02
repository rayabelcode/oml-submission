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
			return ['Start your first conversation to see AI conversation notes!'];
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

// Analyze sentiment trends over time
const getSentimentTrends = async (contact, history) => {
	const response = await openai.chat.completions.create({
		model: 'gpt-3.5-turbo',
		messages: [
			{
				role: 'system',
				content:
					'You are a concise sentiment analyst. Provide ONE brief insight about how relationship tone has evolved.',
			},
			{
				role: 'user',
				content: `How has my relationship with ${contact.first_name} changed over time?
					
					Conversation History (chronological):
					${history.map((entry, i) => `${new Date(entry.date).toLocaleDateString()}: ${entry.notes}`).join('\n')}
					
					1-2 sentences only, focused on specific changes in tone, depth, or topics.`,
			},
		],
		max_tokens: 100,
		temperature: 0.7,
	});

	return (
		response.choices[0]?.message?.content?.trim() || 'Not enough history yet to analyze sentiment trends'
	);
};

// Generate personalized next steps based on history and upcoming events
const getPersonalizedNextSteps = async (contact, history, upcomingBirthday) => {
	// Extract recent topic if available
	let recentTopics = '';
	if (history.length > 0) {
		const latestEntry = history[history.length - 1];
		recentTopics = `Recent conversation: "${latestEntry.notes.substring(0, 100)}${
			latestEntry.notes.length > 100 ? '...' : ''
		}"`;
	}

	// Get relationship type from contact data
	const relationshipType = contact.scheduling?.relationship_type || 'friend';

	// Map relationship type to appropriate context
	const relationshipContext =
		{
			friend: 'friendship',
			family: 'family relationship',
			work: 'professional relationship',
			personal: 'romantic relationship',
		}[relationshipType] || 'friendship';

	const response = await openai.chat.completions.create({
		model: 'gpt-3.5-turbo',
		messages: [
			{
				role: 'system',
				content: `You are a concise relationship coach. Provide ONE specific, actionable suggestion tied to their conversation history and appropriate for a ${relationshipContext}.
				
For family members: Suggest family-appropriate activities or topics
For work contacts: Suggest professional, workplace-appropriate actions
For friends: Suggest casual, friendship-building activities
For personal/romantic contacts: Suggest romantic or relationship-building activities`,
			},
			{
				role: 'user',
				content: `What's ONE specific action I could take with ${
					contact.first_name
				}, who is categorized in my '${relationshipType}' contacts?
					
					${upcomingBirthday ? `IMPORTANT: Birthday coming up on ${upcomingBirthday}` : ''}
					${recentTopics}
					
					Contact Type: ${relationshipType} (${relationshipContext})
					
					Recent conversations:
					${history
						.slice(-3)
						.map(
							(entry) =>
								`${new Date(entry.date).toLocaleDateString()}: ${entry.notes.substring(0, 80)}${
									entry.notes.length > 80 ? '...' : ''
								}`
						)
						.join('\n')}
					
					Give me a single, specific suggestion tied to our conversations and appropriate for our ${relationshipContext}. Max 2 sentences.`,
			},
		],
		max_tokens: 100,
		temperature: 0.8,
	});

	return response.choices[0]?.message?.content?.trim() || 'Continue building conversation history';
};

// Generate relationship insights based on contact and history
export const generateRelationshipInsights = async (contact, history) => {
	try {
		// Use 10 history entries
		const historyToAnalyze = history.slice(-10);

		// Check for upcoming birthday to include in next steps
		const upcomingBirthday = checkUpcomingBirthday(contact);

		// Run only two analyses in parallel
		const [trends, nextSteps] = await Promise.all([
			getSentimentTrends(contact, historyToAnalyze),
			getPersonalizedNextSteps(contact, historyToAnalyze, upcomingBirthday),
		]);

		return {
			conversationFlow: [
				{
					title: 'Relationship Trend',
					description: trends,
				},
				{
					title: 'Next Steps',
					description: nextSteps,
				},
			],
		};
	} catch (error) {
		console.error('Error in generateRelationshipInsights:', error);
		return {
			conversationFlow: [
				{
					title: 'Relationship Trend',
					description: 'Keep building your conversation history to see trends',
				},
				{
					title: 'Next Steps',
					description: 'Continue building conversation history to get personalized suggestions',
				},
			],
		};
	}
};

// Check for upcoming birthdays within 30 days
export const checkUpcomingBirthday = (contact) => {
	if (!contact.birthday) return null;

	// Parse MM-DD format
	const [month, day] = contact.birthday.split('-').map((num) => parseInt(num, 10));

	const today = new Date();
	const birthday = new Date(today.getFullYear(), month - 1, day);

	// If birthday has passed this year, look at next year's date
	if (birthday < today) {
		birthday.setFullYear(today.getFullYear() + 1);
	}

	const daysUntilBirthday = Math.ceil((birthday - today) / (1000 * 60 * 60 * 24));

	// Only return the date if birthday is within next 30 days
	return daysUntilBirthday <= 30 ? birthday.toLocaleDateString() : null;
};
