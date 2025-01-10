import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const getUserPreferences = async (userId) => {
	try {
		const userDoc = await getDoc(doc(db, 'users', userId));
		if (!userDoc.exists()) {
			throw new Error('User preferences not found');
		}
		return userDoc.data().scheduling_preferences || {};
	} catch (error) {
		console.error('Error getting user preferences:', error);
		throw error;
	}
};

export const updateUserPreferences = async (userId, updates) => {
	try {
		const userRef = doc(db, 'users', userId);

		// Convert dot notation to nested object
		const formattedUpdates = {};
		Object.entries(updates).forEach(([key, value]) => {
			if (key.includes('.')) {
				const [parent, child] = key.split('.');
				if (!formattedUpdates[parent]) {
					formattedUpdates[parent] = {};
				}
				formattedUpdates[parent][child] = value;
			} else {
				formattedUpdates[key] = value;
			}
		});

		await updateDoc(userRef, formattedUpdates);
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
