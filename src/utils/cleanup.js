// src/utils/cleanup.js
import { AppState } from 'react-native';
import { notificationCoordinator } from './notificationCoordinator';
import { NOTIFICATION_CONFIGS, REMINDER_TYPES } from '../../constants/notificationConstants';
import { getReminder, updateReminder, getContactById, deleteReminder, addContactHistory } from './firestore';
import * as Notifications from 'expo-notifications';

class CleanupService {
	constructor() {
		this.initialized = false;
		this.lastCleanupTime = null;
	}

	// Initialize cleanup service and setup app state listener
	async initialize() {
		if (this.initialized) {
			return true;
		}

		AppState.addEventListener('change', async (nextAppState) => {
			if (nextAppState === 'active') {
				const now = new Date();
				if (!this.lastCleanupTime || now - this.lastCleanupTime > 6 * 60 * 60 * 1000) {
					await this.performCleanup();
					this.lastCleanupTime = now;
				}
			}
		});

		this.initialized = true;
		return true;
	}

	// Check if reminder needs cleanup based on type and status
	async shouldCleanupReminder(reminder, now) {
		try {
			if (reminder.type === REMINDER_TYPES.FOLLOW_UP) {
				if (reminder.notes_added) return true;

				const reminderTime = reminder.scheduledTime.toDate();
				return now - reminderTime >= NOTIFICATION_CONFIGS.FOLLOW_UP.TIMEOUT;
			}

			if (reminder.type === REMINDER_TYPES.SCHEDULED) {
				if (reminder.status === 'pending') {
					const scheduledTime = reminder.scheduledTime.toDate();
					if (now < scheduledTime) return false;
				}
				return ['completed', 'skipped', 'expired'].includes(reminder.status);
			}

			return false;
		} catch (error) {
			console.error('[CleanupService] Error checking reminder:', error);
			return false;
		}
	}

	// Run cleanup for all notifications that need it
	async performCleanup() {
		try {
			const now = new Date();

			for (const [firestoreId, data] of notificationCoordinator.notificationMap.entries()) {
				try {
					const reminder = await getReminder(firestoreId);
					if (!reminder) continue;

					const shouldCleanup = await this.shouldCleanupReminder(reminder, now);
					if (shouldCleanup) {
						await this.cleanupReminder(firestoreId, reminder, data.localId);
					}
				} catch (error) {
					console.error('[CleanupService] Error processing reminder:', error);
					return false;
				}
			}

			return true;
		} catch (error) {
			console.error('[CleanupService] Cleanup error:', error);
			return false;
		}
	}

	// Clean up a single reminder
	async cleanupReminder(firestoreId, reminder, localId) {
		try {
			// Cancel local notification if it exists
			if (localId) {
				await Notifications.cancelScheduledNotificationAsync(localId);
			}

			// Create history entry if reminder was completed or had notes
			if (reminder.status === 'completed' || reminder.notes_added) {
				const historyEntry = {
					date: new Date().toISOString(), // Use current date instead of reminder's date
					type: reminder.type,
					status: reminder.status,
					notes: reminder.notes || '',
					completed: reminder.status === 'completed',
				};

				await addContactHistory(reminder.contact_id, historyEntry);
			}

			// Delete the reminder
			await deleteReminder(firestoreId);

			// Clean up notification map
			notificationCoordinator.notificationMap.delete(firestoreId);
			await notificationCoordinator.saveNotificationMap();

			return true;
		} catch (error) {
			console.error('[CleanupService] Error cleaning reminder:', error);
			throw error;
		}
	}
}

export const cleanupService = new CleanupService();
