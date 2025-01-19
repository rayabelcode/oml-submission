import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

const handlePushError = async (error, userIds) => {
	console.error('Push notification error:', error);

	// If token was invalid, remove it from the user's document
	if (error.message?.includes('InvalidToken')) {
		await Promise.all(
			userIds.map(async (userId) => {
				const userRef = doc(db, 'users', userId);
				await updateDoc(userRef, {
					expoPushToken: null,
					lastTokenUpdate: serverTimestamp(),
				});
			})
		);
	}

	return false;
};

export const sendPushNotification = async (userIds, notification) => {
	try {
		// Get tokens for all users
		const tokenPromises = userIds.map(async (userId) => {
			const userDoc = await getDoc(doc(db, 'users', userId));
			return userDoc.data()?.expoPushToken;
		});

		const tokens = (await Promise.all(tokenPromises)).filter(Boolean);

		// Don't make the API call if there are no valid tokens
		if (tokens.length === 0) {
			return true; // Return true since this isn't an error case
		}

		// Send to each token
		const messages = tokens.map((token) => ({
			to: token,
			sound: 'default',
			title: notification.title,
			body: notification.body,
			data: notification.data || {},
			badge: 1,
			_displayInForeground: true,
		}));

		const response = await fetch(EXPO_PUSH_ENDPOINT, {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(messages),
		});

		return response.ok;
	} catch (error) {
		return handlePushError(error, userIds);
	}
};

export const scheduleLocalNotificationWithPush = async (userId, content, trigger) => {
	try {
		// Schedule local notification
		const localNotificationId = await Notifications.scheduleNotificationAsync({
			content,
			trigger,
		});

		// Send push notification if scheduled for future
		if (trigger.seconds > 0) {
			await sendPushNotification([userId], {
				title: content.title,
				body: content.body,
				data: {
					...content.data,
					localNotificationId,
				},
			});
		}

		return localNotificationId;
	} catch (error) {
		console.error('Error scheduling notification with push:', error);
		throw error;
	}
};
