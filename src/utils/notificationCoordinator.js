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

			// Load stored data
			await this.loadStoredData();

			// Initialize services
			await this.initializeServices();

			// Set up app state and network listeners
			this.setupEventListeners();

			// Start maintenance intervals
			this.startMaintenanceIntervals();

			this.initialized = true;
			return true;
		} catch (error) {
			console.error('Failed to initialize notification coordinator:', error);
			return false;
		}
	}

	async setupIOSCategories() {
		const categories = IOS_CONFIGS.NOTIFICATION_SETTINGS.CATEGORIES;
		for (const [key, category] of Object.entries(categories)) {
			await Notifications.setNotificationCategoryAsync(category.identifier, category.actions);
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
			await this.syncPendingNotifications();
			await this.performCleanup();
		}
	}

	async handleNetworkChange(state) {
		if (state.isConnected) {
			await this.syncPendingNotifications();
		}
	}

	async scheduleNotification(content, trigger, options = {}) {
		if (!this.initialized) {
			await this.initialize();
		}

		try {
			// Prepare notification content
			const finalContent = {
				...content,
				...(Platform.OS === 'ios' &&
					options.type && {
						categoryIdentifier: IOS_CONFIGS.NOTIFICATION_SETTINGS.CATEGORIES[options.type].identifier,
					}),
			};

			// Schedule the notification
			const notificationId = await Notifications.scheduleNotificationAsync({
				content: finalContent,
				trigger,
			});

			// Store in notification map
			this.notificationMap.set(notificationId, {
				content: finalContent,
				trigger,
				options,
				timestamp: new Date().toISOString(),
			});

			await this.saveNotificationMap();

			// Handle offline queue if needed
			if (!options.skipQueue && !(await this.checkConnectivity())) {
				await this.addToPendingQueue(notificationId, finalContent, trigger, options);
			}

			return notificationId;
		} catch (error) {
			console.error('Error scheduling notification:', error);
			if (options.retry !== false) {
				return this.handleSchedulingError(content, trigger, options);
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

	async addToPendingQueue(notificationId, content, trigger, options) {
		if (this.pendingQueue.size >= ERROR_HANDLING.OFFLINE.MAX_QUEUE_SIZE) {
			throw new Error('Pending queue size limit reached');
		}

		this.pendingQueue.set(notificationId, {
			content,
			trigger,
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

				if (age > NOTIFICATION_CONFIGS[data.options.type]?.CLEANUP?.TIMEOUT) {
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
				this.scheduleNotification(data.content, data.trigger, {
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
	}
}

export const notificationCoordinator = new NotificationCoordinator();
