import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const getUserPreferences = async (userId) => {
	try {
		const userDoc = await getDoc(doc(db, 'users', userId));
		if (!userDoc.exists()) {
			throw new Error('User document not found');
		}
		const userData = userDoc.data();
		return {
			minimumGapMinutes: userData.scheduling_preferences?.minimumGapMinutes || 30,
			optimalGapMinutes: userData.scheduling_preferences?.optimalGapMinutes || 120,
			...userData.scheduling_preferences,
		};
	} catch (error) {
		console.error('Error getting user preferences:', error);
		throw error;
	}
};

export const updateUserPreferences = async (userId, newPreferences) => {
	try {
		const userRef = doc(db, 'users', userId);
		const userDoc = await getDoc(userRef);

		if (!userDoc.exists()) {
			throw new Error('User document not found');
		}

		const updates = {};

		if (newPreferences.minimumGapMinutes !== undefined) {
			updates['scheduling_preferences.minimumGapMinutes'] = newPreferences.minimumGapMinutes;
		}

		if (newPreferences.optimalGapMinutes !== undefined) {
			updates['scheduling_preferences.optimalGapMinutes'] = newPreferences.optimalGapMinutes;
		}

		await updateDoc(userRef, updates);
		return true;
	} catch (error) {
		console.error('Error updating user preferences:', error);
		throw error;
	}
};

export const defaultPreferences = {
	minimumGapMinutes: 30,
	optimalGapMinutes: 120,
	global_excluded_times: [
		{
			days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
			end: '07:00',
			start: '23:00',
		},
	],
	max_reminders_per_day: 5,
};
