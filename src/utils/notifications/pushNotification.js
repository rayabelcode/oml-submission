import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { ERROR_HANDLING } from '../../../constants/notificationConstants';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
// For Jest testing
export const _internal = {
	delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

const calculateRetryDelay = (attempt, baseDelay) => {
	const jitter = Math.random() * ERROR_HANDLING.RETRY.PUSH.JITTER;
	return baseDelay * Math.pow(ERROR_HANDLING.RETRY.PUSH.BACKOFF_RATE, attempt) + jitter;
};

const getPushErrorType = (error) => {
	if (error.message?.includes('InvalidToken')) return ERROR_HANDLING.RETRY.PUSH.ERROR_CODES.INVALID_TOKEN;
	if (error.message?.includes('rate limit')) return ERROR_HANDLING.RETRY.PUSH.ERROR_CODES.RATE_LIMIT;
	if (error.message?.includes('network')) return ERROR_HANDLING.RETRY.PUSH.ERROR_CODES.NETWORK_ERROR;
	if (error.status >= 500) return ERROR_HANDLING.RETRY.PUSH.ERROR_CODES.SERVER_ERROR;
	return 'UnknownError';
};

const shouldRetry = (errorType, attempt) => {
	if (errorType === ERROR_HANDLING.RETRY.PUSH.ERROR_CODES.INVALID_TOKEN) return false;
	if (attempt >= ERROR_HANDLING.RETRY.PUSH.MAX_ATTEMPTS) return false;
	return true;
};

const handlePushError = async (error, userIds) => {
	console.error('Push notification error:', error);

	if (error.message?.includes('InvalidToken')) {
		await Promise.all(
			userIds.map(async (userId) => {
				const userRef = doc(db, 'users', userId);
				// Remove invalid token from array instead of setting to null
				const userDoc = await getDoc(userRef);
				const tokens = userDoc.data()?.expoPushTokens || [];
				const validTokens = tokens.filter((token) => !error.message.includes(token));
				await updateDoc(userRef, {
					expoPushTokens: validTokens,
					lastTokenUpdate: serverTimestamp(),
				});
			})
		);
	}

	return false;
};

const handleFailedTokens = async (failedTokens, userIds) => {
	const invalidTokens = failedTokens
		.filter((item) => item.message?.includes('InvalidToken'))
		.map((item) => item.token);

	if (invalidTokens.length > 0) {
		await Promise.all(
			userIds.map(async (userId) => {
				const userDoc = await getDoc(doc(db, 'users', userId));
				const tokens = userDoc.data()?.expoPushTokens || [];
				const validTokens = tokens.filter((token) => !invalidTokens.includes(token));
				await updateDoc(doc(db, 'users', userId), {
					expoPushTokens: validTokens,
					lastTokenUpdate: serverTimestamp(),
				});
			})
		);
	}
};

const sendPushNotification = async (userIds, notification, attempt = 0) => {
	try {
		// Get all tokens for all users
		const tokenPromises = userIds.map(async (userId) => {
			const userDoc = await getDoc(doc(db, 'users', userId));
			return userDoc.data()?.expoPushTokens || [];
		});

		const tokenArrays = await Promise.all(tokenPromises);
		// Flatten array of token arrays and remove any empty/null values
		const tokens = tokenArrays.flat().filter(Boolean);

		if (tokens.length === 0) {
			return true;
		}

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

		if (!response.ok) {
			throw new Error(`Server responded with ${response.status}`);
		}

		// Parse response to check for token errors
		const responseData = await response.json();
		const failedTokens = responseData.data?.filter((item) => item.status === 'error');

		if (failedTokens?.length > 0) {
			await handleFailedTokens(failedTokens, userIds);
		}

		return true;
	} catch (error) {
		const errorType = getPushErrorType(error);

		if (shouldRetry(errorType, attempt)) {
			const delay = calculateRetryDelay(attempt, ERROR_HANDLING.RETRY.PUSH.INTERVALS[0]);
			await _internal.delay(delay);
			return sendPushNotification(userIds, notification, attempt + 1);
		}

		return handlePushError(error, userIds);
	}
};

export const scheduleLocalNotificationWithPush = async (userId, content, scheduledTime) => {
	try {
		// Check cloud notifications preference
		const cloudNotificationsEnabled = await AsyncStorage.getItem('cloudNotificationsEnabled');

		// Schedule local notification
		const triggerTime = scheduledTime instanceof Date ? scheduledTime : new Date(scheduledTime);
		const localNotificationId = await Notifications.scheduleNotificationAsync({
			content,
			trigger: triggerTime,
		});

		// Only send push notification if cloud notifications are enabled
		if (cloudNotificationsEnabled === 'true' && triggerTime > new Date()) {
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
