import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { NOTIFICATION_MAP_KEY } from '../../constants/notificationConstants';

class NotificationCoordinator {
    constructor() {
        this.badgeCount = 0;
        this.initialized = false;
        this.notificationMap = new Map();
        this.services = new Map();
    }

    registerService(name, service) {
        this.services.set(name, service);
    }

    async initialize() {
        if (this.initialized) return;

        try {
					Notifications.setNotificationHandler({
						handleNotification: async () => ({
							shouldShowAlert: true,
							shouldPlaySound: true,
							shouldSetBadge: true,
						}),
					});

					await this.requestPermissions();

					const storedBadgeCount = await AsyncStorage.getItem('badgeCount');
					this.badgeCount = storedBadgeCount ? parseInt(storedBadgeCount, 10) : 0;

					const storedMap = await AsyncStorage.getItem(NOTIFICATION_MAP_KEY);
					if (storedMap) {
						this.notificationMap = new Map(JSON.parse(storedMap));
					}

					// Initialize all registered services
					for (const [, service] of this.services) {
						if (service.initialize) {
							await service.initialize();
						}
					}

					this.initialized = true;
					return true;
				} catch (error) {
            console.error('Failed to initialize notification coordinator:', error);
            return false;
        }
    }

    async requestPermissions() {
        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
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

    // Core notification methods that other services will use
    async scheduleNotification(content, trigger) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            return await Notifications.scheduleNotificationAsync({
                content,
                trigger,
            });
        } catch (error) {
            console.error('Error scheduling notification:', error);
            throw error;
        }
    }

    async cancelNotification(localNotificationId) {
        try {
            await Notifications.cancelScheduledNotificationAsync(localNotificationId);
            return true;
        } catch (error) {
            console.error('Error canceling notification:', error);
            return false;
        }
    }

    async saveNotificationMap() {
        try {
            await AsyncStorage.setItem(
                NOTIFICATION_MAP_KEY,
                JSON.stringify(Array.from(this.notificationMap.entries()))
            );
        } catch (error) {
            console.error('Error saving notification map:', error);
        }
    }

    // Badge management
    async incrementBadge() {
        this.badgeCount++;
        await AsyncStorage.setItem('badgeCount', this.badgeCount.toString());
        return this.badgeCount;
    }

    async decrementBadge() {
        if (this.badgeCount > 0) {
            this.badgeCount--;
            await AsyncStorage.setItem('badgeCount', this.badgeCount.toString());
        }
        return this.badgeCount;
    }

    getService(name) {
        return this.services.get(name);
    }
}

export const notificationCoordinator = new NotificationCoordinator();
