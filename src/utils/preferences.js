import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { DateTime } from 'luxon';
import { db } from '../config/firebase';

export const getUserPreferences = async (userId) => {
	try {
		const userRef = doc(db, 'users', userId);
		const userDoc = await getDoc(userRef);
		if (!userDoc.exists()) {
			return defaultPreferences; // Return defaults if no doc exists
		}
		const data = userDoc.data();
		return {
			...defaultPreferences,
			...data.scheduling_preferences,
			timezone: data.scheduling_preferences?.timezone || defaultPreferences.timezone,
		};
	} catch (error) {
		console.error('Error getting user preferences:', error);
		return defaultPreferences; // Return defaults on error
	}
};

export const updateUserPreferences = async (userId, updates) => {
	try {
		// Remove all undefined values
		const sanitizedUpdates = JSON.parse(
			JSON.stringify(updates, (key, value) => (value === undefined ? null : value))
		);

		const userRef = doc(db, 'users', userId);
		await updateDoc(userRef, {
			scheduling_preferences: sanitizedUpdates.scheduling_preferences,
			last_updated: serverTimestamp(),
		});
	} catch (error) {
		console.error('Error updating user preferences:', error);
		throw error;
	}
};

export const defaultPreferences = {
	minimumGapMinutes: 30,
	optimalGapMinutes: 120,
	timezone: DateTime.local().zoneName,
	global_excluded_times: [
		{
			days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
			end: '07:00',
			start: '23:00',
		},
	],
	max_reminders_per_day: 5,
};
