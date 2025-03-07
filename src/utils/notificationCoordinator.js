import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState } from 'react-native';
import * as NetInfo from '@react-native-community/netinfo';
import {
	NOTIFICATION_MAP_KEY,
	COORDINATOR_CONFIG,
	ERROR_HANDLING,
	IOS_CONFIGS,
	NOTIFICATION_CONFIGS,
} from '../../constants/notificationConstants';
import { sendPushNotification, scheduleLocalNotificationWithPush } from './notifications/pushNotification';
import { doc, getUserProfile, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { reminderSync } from './notifications/reminderSync';
import { snoozeHandler, initializeSnoozeHandler } from './scheduler/snoozeHandler';
import { DateTime } from 'luxon';

class NotificationCoordinator {
	constructor() {
		this.badgeCount = 0;
		this.initialized = false;
		this.notificationMap = new Map();
		this.services = new Map();
		this.pendingQueue = new Map();
		this.pendingOperations = new Map(); // For offline operations
		this.lastCleanupTime = null;
		this.lastSyncTime = null;
		this.appStateSubscription = null;
		this.networkSubscription = null;
	}

	registerService(name, service) {
		this.services.set(name, service);
	}

	async initialize() {
		if (this.initialized) return;

		try {
			if (Platform.OS === 'ios') {
				await this.setupIOSCategories();
			}

			Notifications.setNotificationHandler({
				handleNotification: async () => ({
					shouldShowAlert: true,
					shouldPlaySound: true,
					shouldSetBadge: true,
					...(Platform.OS === 'ios' && IOS_CONFIGS.NOTIFICATION_SETTINGS.FOREGROUND),
				}),
			});

			await this.requestPermissions();

			if (Platform.OS === 'ios' && auth.currentUser) {
				try {
					const token = (
						await Notifications.getExpoPushTokenAsync({
							projectId: 'a2b79805-c750-4012-92e8-fee850d83b9c',
						})
					).data;

					const userDoc = doc(db, 'users', auth.currentUser.uid);
					await updateDoc(userDoc, {
						expoPushTokens: arrayUnion(token),
						devicePlatform: Platform.OS,
						lastTokenUpdate: serverTimestamp(),
					});

					await reminderSync.start();
				} catch (tokenError) {
					console.error('Error storing push token:', tokenError);
				}
			}

			await this.loadStoredData();
			await this.initializeServices();
			this.setupEventListeners();
			this.startMaintenanceIntervals();

			this.initialized = true;
			return true;
		} catch (error) {
			console.error('Error in initialize:', error);
			return false;
		}
	}

	async setupIOSCategories() {
		if (Platform.OS === 'ios') {
			await Notifications.setNotificationCategoryAsync('FOLLOW_UP', [
				{
					identifier: 'add_notes',
					buttonTitle: 'Add Notes',
					options: {
						opensAppToForeground: false,
						textInput: {
							submitButtonTitle: 'Save',
							placeholder: 'Enter your call notes...',
						},
					},
				},
				{
					identifier: 'dismiss',
					buttonTitle: 'Dismiss',
					options: {
						opensAppToForeground: false,
						isDestructive: true,
					},
				},
			]);

			await Notifications.setNotificationCategoryAsync('SCHEDULED', [
				{
					identifier: 'call_now',
					buttonTitle: 'Contact Now',
					options: {
						opensAppToForeground: true,
					},
				},
				{
					identifier: 'snooze',
					buttonTitle: 'Snooze',
					options: {
						opensAppToForeground: true,
					},
				},
			]);

			await Notifications.setNotificationCategoryAsync('CUSTOM_DATE', [
				{
					identifier: 'call_now',
					buttonTitle: 'Contact Now',
					options: {
						opensAppToForeground: true,
					},
				},
				{
					identifier: 'snooze',
					buttonTitle: 'Snooze',
					options: {
						opensAppToForeground: true,
					},
				},
			]);
		}
	}

	async clearAllNotifications() {
		try {
			await Notifications.cancelAllScheduledNotificationsAsync();

			this.notificationMap.clear();
			await AsyncStorage.removeItem(COORDINATOR_CONFIG.STORAGE_KEYS.NOTIFICATION_MAP);

			this.pendingQueue.clear();
			await AsyncStorage.removeItem(COORDINATOR_CONFIG.STORAGE_KEYS.PENDING_QUEUE);

			// Clear pending operations
			this.pendingOperations.clear();
			await AsyncStorage.removeItem('pendingOperations');

			await AsyncStorage.removeItem('follow_up_notifications');

			await this.resetBadge();

			return true;
		} catch (error) {
			console.error('[NotificationCoordinator] Error clearing all notifications:', error);
			return false;
		}
	}

	async requestPermissions() {
		try {
			const { status: existingStatus } = await Notifications.getPermissionsAsync();
			let finalStatus = existingStatus;

			if (existingStatus !== 'granted') {
				const { status } = await Notifications.requestPermissionsAsync({
					ios: {
						allowAlert: true,
						allowBadge: true,
						allowSound: true,
						allowAnnouncements: true,
					},
				});
				finalStatus = status;
			}

			if (finalStatus !== 'granted') {
				throw new Error('Permission not granted for notifications');
			}

			if (Platform.OS === 'android') {
				await Notifications.setNotificationChannelAsync('default', {
					name: 'default',
					importance: Notifications.AndroidImportance.MAX,
					vibrationPattern: [0, 250, 250, 250],
					lightColor: '#FF231F7C',
				});
			}

			await reminderSync.start();

			return true;
		} catch (error) {
			console.error('Error requesting notification permissions:', error);
			return false;
		}
	}

	async loadStoredData() {
		try {
			const [storedBadgeCount, storedMap, storedQueue, storedCleanupTime, storedSyncTime, storedOperations] =
				await Promise.all([
					AsyncStorage.getItem('badgeCount'),
					AsyncStorage.getItem(COORDINATOR_CONFIG.STORAGE_KEYS.NOTIFICATION_MAP),
					AsyncStorage.getItem(COORDINATOR_CONFIG.STORAGE_KEYS.PENDING_QUEUE),
					AsyncStorage.getItem(COORDINATOR_CONFIG.STORAGE_KEYS.LAST_CLEANUP),
					AsyncStorage.getItem(COORDINATOR_CONFIG.STORAGE_KEYS.LAST_SYNC),
					AsyncStorage.getItem('pendingOperations'),
				]);

			this.badgeCount = storedBadgeCount ? parseInt(storedBadgeCount, 10) : 0;
			this.notificationMap = storedMap ? new Map(JSON.parse(storedMap)) : new Map();
			this.pendingQueue = storedQueue ? new Map(JSON.parse(storedQueue)) : new Map();
			this.pendingOperations = storedOperations ? new Map(JSON.parse(storedOperations)) : new Map();
			this.lastCleanupTime = storedCleanupTime ? new Date(storedCleanupTime) : null;
			this.lastSyncTime = storedSyncTime ? new Date(storedSyncTime) : null;

			await Notifications.setBadgeCountAsync(this.badgeCount);
		} catch (error) {
			console.error('Error loading stored data:', error);
			this.badgeCount = 0;
			this.notificationMap = new Map();
			this.pendingQueue = new Map();
			this.pendingOperations = new Map();
			this.lastCleanupTime = null;
			this.lastSyncTime = null;
		}
	}

	async initializeServices() {
		for (const [, service] of this.services) {
			if (service.initialize) {
				await service.initialize();
			}
		}
	}

	setupEventListeners() {
		this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
		this.networkSubscription = NetInfo.addEventListener(this.handleNetworkChange.bind(this));
	}

	async handleAppStateChange(nextAppState) {
		if (nextAppState === 'active') {
			if (auth.currentUser && !reminderSync.initialized) {
				await reminderSync.start();
			}
			await this.syncPendingNotifications();
			await this.processPendingOperations();
			await this.performCleanup();
		}
	}

	async handleNetworkChange(state) {
		if (state.isConnected) {
			await this.syncPendingNotifications();
			await this.processPendingOperations();
		}
	}

	async scheduleNotification(content, scheduledTime, options = {}) {
		if (!this.initialized) {
			await this.initialize();
		}

		try {
			const userId = auth.currentUser?.uid;
			if (!userId) throw new Error('User not authenticated');

			if (options.replaceId) {
				const existingNotification = this.notificationMap.get(options.replaceId);
				if (existingNotification) {
					await this.cancelNotification(options.replaceId);
				}
			}

			const triggerTime = scheduledTime instanceof Date ? scheduledTime : new Date(scheduledTime);

			const finalContent = {
				...content,
				...(Platform.OS === 'ios' &&
					options.type && {
						categoryIdentifier: IOS_CONFIGS.NOTIFICATION_SETTINGS.CATEGORIES[options.type]?.identifier,
					}),
			};

			const localNotificationId = await Notifications.scheduleNotificationAsync({
				content: finalContent,
				trigger: triggerTime,
			});

			const secondsUntilNotification = Math.max(0, Math.floor((triggerTime - new Date()) / 1000));

			this.notificationMap.set(localNotificationId, {
				content: finalContent,
				scheduledTime: triggerTime,
				options,
				timestamp: new Date().toISOString(),
				replacedId: options.replaceId,
			});

			await this.saveNotificationMap();

			if (secondsUntilNotification > 0) {
				try {
					const userDoc = await getUserProfile(userId);
					if (userDoc?.expoPushTokens?.length > 0) {
						await sendPushNotification([userId], {
							title: finalContent.title,
							body: finalContent.body,
							data: {
								...finalContent.data,
								localNotificationId,
								replacedId: options.replaceId,
							},
						});
					}
				} catch (pushError) {
					console.error('Error sending push notification:', pushError);
				}
			}

			if (!options.skipQueue && !(await this.checkConnectivity())) {
				await this.addToPendingQueue(localNotificationId, finalContent, triggerTime, options);
			}

			return localNotificationId;
		} catch (error) {
			console.error('Error scheduling notification:', error);
			if (options.retry !== false) {
				return this.handleSchedulingError(content, scheduledTime, options);
			}
			throw error;
		}
	}

	async handleSchedulingError(content, trigger, options, attempt = 1) {
		if (attempt > ERROR_HANDLING.RETRY.MAX_ATTEMPTS) {
			throw new Error('Max retry attempts reached');
		}

		const delay =
			ERROR_HANDLING.RETRY.INTERVALS[attempt - 1] ||
			ERROR_HANDLING.RETRY.INTERVALS[ERROR_HANDLING.RETRY.INTERVALS.length - 1];

		await new Promise((resolve) => setTimeout(resolve, delay));

		return this.scheduleNotification(content, trigger, {
			...options,
			retry: true,
			attempt: attempt + 1,
		});
	}

	async cancelNotification(notificationId) {
		try {
			await Notifications.cancelScheduledNotificationAsync(notificationId);
			this.notificationMap.delete(notificationId);
			await this.saveNotificationMap();
			return true;
		} catch (error) {
			console.error('Error canceling notification:', error);
			return false;
		}
	}

	async saveNotificationMap() {
		try {
			await AsyncStorage.setItem(
				COORDINATOR_CONFIG.STORAGE_KEYS.NOTIFICATION_MAP,
				JSON.stringify(Array.from(this.notificationMap.entries()))
			);
		} catch (error) {
			console.error('Error saving notification map:', error);
		}
	}

	async checkConnectivity() {
		try {
			const state = await NetInfo.fetch();
			return state.isConnected && state.isInternetReachable;
		} catch (error) {
			console.error('Error checking connectivity:', error);
			return false;
		}
	}

	async addToPendingQueue(notificationId, content, scheduledTime, options) {
		if (this.pendingQueue.size >= ERROR_HANDLING.OFFLINE.MAX_QUEUE_SIZE) {
			throw new Error('Pending queue size limit reached');
		}

		this.pendingQueue.set(notificationId, {
			content,
			scheduledTime,
			options,
			timestamp: new Date().toISOString(),
		});

		await AsyncStorage.setItem(
			COORDINATOR_CONFIG.STORAGE_KEYS.PENDING_QUEUE,
			JSON.stringify(Array.from(this.pendingQueue.entries()))
		);
	}

	// Store a pending operation (for offline snooze functionality)
	async storePendingOperation(operation) {
		const operationId = `op_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

		this.pendingOperations.set(operationId, {
			...operation,
			timestamp: new Date().toISOString(),
			processed: false,
		});

		await AsyncStorage.setItem(
			'pendingOperations',
			JSON.stringify(Array.from(this.pendingOperations.entries()))
		);

		return operationId;
	}

	// Process all pending operations when back online
	async processPendingOperations() {
		if (!(await this.checkConnectivity()) || this.pendingOperations.size === 0) {
			return;
		}

		// Initialize snooze handler if we have any snooze operations
		const hasSnoozeOperations = Array.from(this.pendingOperations.values()).some(
			(op) => op.type === 'snooze' && !op.processed
		);

		if (hasSnoozeOperations && auth.currentUser) {
			await initializeSnoozeHandler(auth.currentUser.uid);
		}

		const successfulIds = [];

		for (const [id, operation] of this.pendingOperations) {
			// Skip already processed operations
			if (operation.processed) continue;

			try {
				if (operation.type === 'snooze') {
					const { contactId, optionId, reminderType, reminderId } = operation.data;

					// Execute the snooze operation
					await snoozeHandler.handleSnooze(contactId, optionId, DateTime.now(), reminderType, reminderId);

					// Mark as processed
					operation.processed = true;
					successfulIds.push(id);
				}
			} catch (error) {
				console.error(`Error processing operation ${id}:`, error);
				// Don't add to successfulIds - will retry later
			}
		}

		// Update operation status
		for (const id of successfulIds) {
			const operation = this.pendingOperations.get(id);
			if (operation) {
				operation.processed = true;
			}
		}

		// Save updated operations
		await AsyncStorage.setItem(
			'pendingOperations',
			JSON.stringify(Array.from(this.pendingOperations.entries()))
		);

		// Clean up old operations (processed and more than 7 days old)
		await this.cleanupProcessedOperations();
	}

	// Remove old processed operations
	async cleanupProcessedOperations() {
		const now = new Date();
		const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

		const oldProcessedIds = Array.from(this.pendingOperations.entries())
			.filter(([, operation]) => {
				return operation.processed && new Date(operation.timestamp) < sevenDaysAgo;
			})
			.map(([id]) => id);

		for (const id of oldProcessedIds) {
			this.pendingOperations.delete(id);
		}

		if (oldProcessedIds.length > 0) {
			await AsyncStorage.setItem(
				'pendingOperations',
				JSON.stringify(Array.from(this.pendingOperations.entries()))
			);
		}
	}

	startMaintenanceIntervals() {
		setInterval(async () => {
			await this.performCleanup();
		}, COORDINATOR_CONFIG.CLEANUP_INTERVAL);

		setInterval(async () => {
			await this.syncPendingNotifications();
			await this.processPendingOperations();
		}, COORDINATOR_CONFIG.SYNC_INTERVAL);
	}

	async performCleanup() {
		try {
			const now = new Date();
			const promises = [];

			for (const [id, data] of this.notificationMap) {
				const timestamp = new Date(data.timestamp);
				const age = now - timestamp;

				const notificationType = data.options?.type || 'FOLLOW_UP';
				const timeoutConfig = NOTIFICATION_CONFIGS[notificationType]?.CLEANUP?.TIMEOUT;

				if (timeoutConfig && age > timeoutConfig) {
					promises.push(this.cancelNotification(id));
				}
			}

			await Promise.all(promises);
			this.lastCleanupTime = now;
			await AsyncStorage.setItem(COORDINATOR_CONFIG.STORAGE_KEYS.LAST_CLEANUP, now.toISOString());

			// Also clean up processed operations
			await this.cleanupProcessedOperations();
		} catch (error) {
			console.error('Error during cleanup:', error);
		}
	}

	async syncPendingNotifications() {
		if (!(await this.checkConnectivity()) || this.pendingQueue.size === 0) {
			return;
		}

		const promises = [];
		for (const [id, data] of this.pendingQueue) {
			promises.push(
				this.scheduleNotification(data.content, data.scheduledTime, {
					...data.options,
					skipQueue: true,
				}).then(() => id)
			);
		}

		const successfulIds = await Promise.allSettled(promises).then((results) =>
			results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
		);

		successfulIds.forEach((id) => this.pendingQueue.delete(id));

		await AsyncStorage.setItem(
			COORDINATOR_CONFIG.STORAGE_KEYS.PENDING_QUEUE,
			JSON.stringify(Array.from(this.pendingQueue.entries()))
		);

		this.lastSyncTime = new Date();
		await AsyncStorage.setItem(COORDINATOR_CONFIG.STORAGE_KEYS.LAST_SYNC, this.lastSyncTime.toISOString());
	}

	async incrementBadge() {
		this.badgeCount++;
		await AsyncStorage.setItem('badgeCount', this.badgeCount.toString());
		await Notifications.setBadgeCountAsync(this.badgeCount);
		return this.badgeCount;
	}

	async decrementBadge() {
		if (this.badgeCount > 0) {
			this.badgeCount--;
			await AsyncStorage.setItem('badgeCount', this.badgeCount.toString());
			await Notifications.setBadgeCountAsync(this.badgeCount);
		}
		return this.badgeCount;
	}

	async resetBadge() {
		this.badgeCount = 0;
		await AsyncStorage.setItem('badgeCount', '0');
		await Notifications.setBadgeCountAsync(0);
		return 0;
	}

	getService(name) {
		return this.services.get(name);
	}

	cleanup() {
		if (this.appStateSubscription) {
			this.appStateSubscription.remove();
		}
		if (this.networkSubscription) {
			this.networkSubscription();
		}

		reminderSync.stop();
	}
}

export const notificationCoordinator = new NotificationCoordinator();
