import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const defaultPreferences = {
	schedule: {
		frequency: 'weekly',
		preferredDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
		preferredTimes: {
			start: '09:00',
			end: '17:00',
		},
		excludedTimes: [
			{
				start: '12:00',
				end: '13:00',
				days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
			},
		],
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		maxRemindersPerDay: 5,
		minimumGapMinutes: 30,
	},
	notifications: {
		enableFollowUp: true,
		followUpDelayMinutes: 60,
		showSuggestions: true,
	},
};

export const getUserPreferences = async (userId) => {
	try {
		const userPrefsDoc = await getDoc(doc(db, 'user_preferences', userId));
		if (!userPrefsDoc.exists()) {
			await setDoc(doc(db, 'user_preferences', userId), defaultPreferences);
			return defaultPreferences;
		}
		return userPrefsDoc.data();
	} catch (error) {
		console.error('Error getting user preferences:', error);
		return defaultPreferences;
	}
};

export const updateUserPreferences = async (userId, newPreferences) => {
	try {
		await setDoc(
			doc(db, 'user_preferences', userId),
			{ ...defaultPreferences, ...newPreferences },
			{ merge: true }
		);
		return true;
	} catch (error) {
		console.error('Error updating user preferences:', error);
		return false;
	}
};
