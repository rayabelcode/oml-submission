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
import { doc, getUserProfile, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { reminderSync } from './notifications/reminderSync';

class NotificationCoordinator {
	constructor() {
		this.badgeCount = 0;
		this.initialized = false;
		this.notificationMap = new Map();
		this.services = new Map();
		this.pendingQueue = new Map();
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
			// Set up iOS specific notification categories
			if (Platform.OS === 'ios') {
				await this.setupIOSCategories();
			}

			// Configure notification handler
			Notifications.setNotificationHandler({
				handleNotification: async () => ({
					shouldShowAlert: true,
					shouldPlaySound: true,
					shouldSetBadge: true,
					...(Platform.OS === 'ios' && IOS_CONFIGS.NOTIFICATION_SETTINGS.FOREGROUND),
				}),
			});

			// Request permissions
			await this.requestPermissions();

			// Get Expo push token and store in Firestore only if user is authenticated
			if (Platform.OS === 'ios' && auth.currentUser) {
				try {
					const token = (
						await Notifications.getExpoPushTokenAsync({
							projectId: 'a2b79805-c750-4012-92e8-fee850d83b9c',
						})
					).data;

					// Store token in user's Firestore document
					const userDoc = doc(db, 'users', auth.currentUser.uid);
					await updateDoc(userDoc, {
						expoPushToken: token,
						devicePlatform: Platform.OS,
						lastTokenUpdate: serverTimestamp(),
					});

					// Start reminder sync after we confirm user is authenticated
					await reminderSync.start();
				} catch (tokenError) {
					console.error('Error storing push token:', tokenError);
					// Continue initialization even if token storage fails
				}
			}

			// Initialization services
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
					buttonTitle: 'Call Now',
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

			// Start reminder sync
			await reminderSync.start();

			return true;
		} catch (error) {
			console.error('Error requesting notification permissions:', error);
			return false;
		}
	}

	async loadStoredData() {
		try {
			const [storedBadgeCount, storedMap, storedQueue, storedCleanupTime, storedSyncTime] = await Promise.all(
				[
					AsyncStorage.getItem('badgeCount'),
					AsyncStorage.getItem(COORDINATOR_CONFIG.STORAGE_KEYS.NOTIFICATION_MAP),
					AsyncStorage.getItem(COORDINATOR_CONFIG.STORAGE_KEYS.PENDING_QUEUE),
					AsyncStorage.getItem(COORDINATOR_CONFIG.STORAGE_KEYS.LAST_CLEANUP),
					AsyncStorage.getItem(COORDINATOR_CONFIG.STORAGE_KEYS.LAST_SYNC),
				]
			);

			this.badgeCount = storedBadgeCount ? parseInt(storedBadgeCount, 10) : 0;
			this.notificationMap = storedMap ? new Map(JSON.parse(storedMap)) : new Map();
			this.pendingQueue = storedQueue ? new Map(JSON.parse(storedQueue)) : new Map();
			this.lastCleanupTime = storedCleanupTime ? new Date(storedCleanupTime) : null;
			this.lastSyncTime = storedSyncTime ? new Date(storedSyncTime) : null;

			// Update badge count on load
			await Notifications.setBadgeCountAsync(this.badgeCount);
		} catch (error) {
			console.error('Error loading stored data:', error);
			// Initialize with defaults if load fails
			this.badgeCount = 0;
			this.notificationMap = new Map();
			this.pendingQueue = new Map();
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
		// App State Changes
		this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));

		// Network Changes
		this.networkSubscription = NetInfo.addEventListener(this.handleNetworkChange.bind(this));
	}

	async handleAppStateChange(nextAppState) {
		if (nextAppState === 'active') {
			// Start reminder sync if user is authenticated
			if (auth.currentUser && !reminderSync.initialized) {
				await reminderSync.start();
			}
			await this.syncPendingNotifications();
			await this.performCleanup();
		}
	}

	async handleNetworkChange(state) {
		if (state.isConnected) {
			await this.syncPendingNotifications();
		}
	}

	async scheduleNotification(content, scheduledTime, options = {}) {
		if (!this.initialized) {
			await this.initialize();
		}

		try {
			const userId = auth.currentUser?.uid;
			if (!userId) throw new Error('User not authenticated');

			// Handle replacing existing notification
			if (options.replaceId) {
				const existingNotification = this.notificationMap.get(options.replaceId);
				if (existingNotification) {
					await this.cancelNotification(options.replaceId);
				}
			}

			// Ensure we have a Date object
			const triggerTime = scheduledTime instanceof Date ? scheduledTime : new Date(scheduledTime);

			// Prepare notification content
			const finalContent = {
				...content,
				...(Platform.OS === 'ios' &&
					options.type && {
						categoryIdentifier: IOS_CONFIGS.NOTIFICATION_SETTINGS.CATEGORIES[options.type]?.identifier,
					}),
			};

			// Schedule the local notification using Date object directly
			const localNotificationId = await Notifications.scheduleNotificationAsync({
				content: finalContent,
				trigger: triggerTime,
			});

			// Calculate seconds until notification
			const secondsUntilNotification = Math.max(0, Math.floor((triggerTime - new Date()) / 1000));

			// Store in notification map
			this.notificationMap.set(localNotificationId, {
				content: finalContent,
				scheduledTime: triggerTime,
				options,
				timestamp: new Date().toISOString(),
				replacedId: options.replaceId,
			});

			await this.saveNotificationMap();

			// Handle push notification
			if (secondsUntilNotification > 0) {
				try {
					const userDoc = await getUserProfile(userId);
					if (userDoc?.expoPushToken) {
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
					// Continue execution even if push notification fails
				}
			}

			// Handle offline queue if needed
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
			return false; // Fail safe - assume offline
		}
	}

	async addToPendingQueue(notificationId, content, scheduledTime, options) {
		if (this.pendingQueue.size >= ERROR_HANDLING.OFFLINE.MAX_QUEUE_SIZE) {
			throw new Error('Pending queue size limit reached');
		}

		this.pendingQueue.set(notificationId, {
			content,
			scheduledTime, // Store the Date object
			options,
			timestamp: new Date().toISOString(),
		});

		await AsyncStorage.setItem(
			COORDINATOR_CONFIG.STORAGE_KEYS.PENDING_QUEUE,
			JSON.stringify(Array.from(this.pendingQueue.entries()))
		);
	}

	startMaintenanceIntervals() {
		// Cleanup interval
		setInterval(async () => {
			await this.performCleanup();
		}, COORDINATOR_CONFIG.CLEANUP_INTERVAL);

		// Sync interval
		setInterval(async () => {
			await this.syncPendingNotifications();
		}, COORDINATOR_CONFIG.SYNC_INTERVAL);
	}

	async performCleanup() {
		try {
			const now = new Date();
			const promises = [];

			// Clean up notification map
			for (const [id, data] of this.notificationMap) {
				const timestamp = new Date(data.timestamp);
				const age = now - timestamp;

				// Null check and default type
				const notificationType = data.options?.type || 'FOLLOW_UP';
				const timeoutConfig = NOTIFICATION_CONFIGS[notificationType]?.CLEANUP?.TIMEOUT;

				if (timeoutConfig && age > timeoutConfig) {
					promises.push(this.cancelNotification(id));
				}
			}

			await Promise.all(promises);
			this.lastCleanupTime = now;
			await AsyncStorage.setItem(COORDINATOR_CONFIG.STORAGE_KEYS.LAST_CLEANUP, now.toISOString());
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

		// Remove successful notifications from pending queue
		successfulIds.forEach((id) => this.pendingQueue.delete(id));

		// Update stored pending queue
		await AsyncStorage.setItem(
			COORDINATOR_CONFIG.STORAGE_KEYS.PENDING_QUEUE,
			JSON.stringify(Array.from(this.pendingQueue.entries()))
		);

		this.lastSyncTime = new Date();
		await AsyncStorage.setItem(COORDINATOR_CONFIG.STORAGE_KEYS.LAST_SYNC, this.lastSyncTime.toISOString());
	}

	// Badge management
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

		// Stop reminder sync
		reminderSync.stop();
	}
}

export const notificationCoordinator = new NotificationCoordinator();
