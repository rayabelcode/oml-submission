import OpenAI from 'openai';
import { OPENAI_API_KEY } from '@env';

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export const generateTopicSuggestions = async (history) => {
  try {
    const recentHistory = history
      .slice(-5)
      .map(
        (entry, index) =>
          `Call ${index + 1} (${new Date(entry.date).toLocaleDateString()}): ${entry.notes}`
      )
      .join('\n');

    const response = await openai.chat.completions.create({
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
      max_tokens: 150,
    });

    const suggestions = response.choices[0]?.message?.content || 'No suggestions available.';
    return suggestions
      .split('\n')
      .map((topic) => topic.trim())
      .filter(Boolean);
  } catch (error) {
    console.error('Error generating topic suggestions:', error);
    throw new Error('Failed to generate suggestions.');
  }
};
