import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { callNotesService } from './callNotes';
import { scheduledCallService } from './scheduledCalls';
import { schedulingHistory } from './schedulingHistory';
import { NOTIFICATION_MAP_KEY } from '../../constants/notificationConstants';
import { notificationCoordinator } from './notificationCoordinator';
import { scheduledCallService } from './scheduledCalls';

class NotificationService {
    constructor() {
        this.badgeCount = 0;
        this.initialized = false;
        this.notificationMap = new Map();
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

            // Request permissions during initialization
            await this.requestPermissions();

            // Restore badge count
            const storedBadgeCount = await AsyncStorage.getItem('badgeCount');
            this.badgeCount = storedBadgeCount ? parseInt(storedBadgeCount, 10) : 0;

            // Restore notification map
            const storedMap = await AsyncStorage.getItem(NOTIFICATION_MAP_KEY);
            if (storedMap) {
                this.notificationMap = new Map(JSON.parse(storedMap));
            }

            // Initialize sub-services
            await Promise.all([
                callNotesService.initialize(),
                scheduledCallService.initialize(),
                schedulingHistory.initialize()
            ]);

            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize notification service:', error);
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

    async scheduleNotification(content, trigger) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const localNotificationId = await Notifications.scheduleNotificationAsync({
                content,
                trigger,
            });

            return localNotificationId;
        } catch (error) {
            console.error('Error scheduling notification:', error);
            throw error;
        }
    }

    async scheduleCallFollowUp(contact) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            return await callNotesService.scheduleFollowUp(contact);
        } catch (error) {
            console.error('Error scheduling call follow-up:', error);
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

    async clearAllNotifications() {
        try {
            await Notifications.cancelAllScheduledNotificationsAsync();
            this.badgeCount = 0;
            await AsyncStorage.setItem('badgeCount', '0');
            return true;
        } catch (error) {
            console.error('Error clearing all notifications:', error);
            return false;
        }
    }

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
}

export const notificationService = new NotificationService();
