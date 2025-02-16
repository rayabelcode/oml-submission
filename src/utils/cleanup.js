import { AppState } from 'react-native';
import { notificationCoordinator } from './notificationCoordinator';
import { NOTIFICATION_CONFIGS, REMINDER_TYPES } from '../../constants/notificationConstants';
import { getReminder, updateReminder, getContactById, deleteReminder, addContactHistory } from './firestore';
import * as Notifications from 'expo-notifications';

class CleanupService {
	constructor() {
		this.initialized = false;
		this.lastCleanupTime = null;
		this.cleanupStats = {
			lastRunTime: null,
			successCount: 0,
			failureCount: 0,
			lastError: null,
		};
	}

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

	async shouldCleanupReminder(reminder, now) {
		try {
			// Handle null/undefined reminders
			if (!reminder) return true;

			if (reminder.type === REMINDER_TYPES.FOLLOW_UP) {
				// Only clean up if notes were added or explicitly completed
				return reminder.notes_added || reminder.status === 'completed';
			}

			if (reminder.type === REMINDER_TYPES.SCHEDULED || reminder.type === REMINDER_TYPES.CUSTOM_DATE) {
				// For scheduled reminders, missing scheduledTime is an error state
				// that should be cleaned up
				if (!reminder.scheduledTime) return true;

				if (reminder.status === 'pending') {
					try {
						const scheduledTime = reminder.scheduledTime?.toDate();
						if (!scheduledTime || now < scheduledTime) return false;
					} catch (error) {
						// If we can't parse the scheduledTime, clean it up
						return true;
					}
				}
				return ['completed', 'skipped', 'expired'].includes(reminder.status);
			}

			return false;
		} catch (error) {
			console.error('[CleanupService] Error checking reminder:', error);
			return false;
		}
	}

	async performCleanup(retryCount = 3) {
		for (let attempt = 1; attempt <= retryCount; attempt++) {
			try {
				const result = await this._performCleanup();
				this.cleanupStats.lastRunTime = new Date();
				this.cleanupStats.lastError = null;
				return result;
			} catch (error) {
				console.error(`[CleanupService] Attempt ${attempt} failed:`, error);
				this.cleanupStats.failureCount++;
				this.cleanupStats.lastError = error;
				if (attempt === retryCount) throw error;
				await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
			}
		}
	}

	async _performCleanup() {
		try {
			const now = new Date();
			const batchSize = 50;
			const reminders = Array.from(notificationCoordinator.notificationMap.entries());

			for (let i = 0; i < reminders.length; i += batchSize) {
				const batch = reminders.slice(i, i + batchSize);
				await Promise.all(
					batch.map(async ([firestoreId, data]) => {
						try {
							// Handle null/corrupt data case
							if (!data) {
								await this.cleanupReminder(firestoreId, null, null);
								this.cleanupStats.successCount++;
								return;
							}

							const reminder = await getReminder(firestoreId);
							if (!reminder) {
								await this.cleanupReminder(firestoreId, null, data?.localId);
								this.cleanupStats.successCount++;
								return;
							}

							const shouldCleanup = await this.shouldCleanupReminder(reminder, now);
							if (shouldCleanup) {
								await this.cleanupReminder(firestoreId, reminder, data?.localId);
								this.cleanupStats.successCount++;
							}
						} catch (error) {
							console.error(`[CleanupService] Error processing reminder ${firestoreId}:`, error);
							this.cleanupStats.failureCount++;
						}
					})
				);
			}
			return true;
		} catch (error) {
			console.error('[CleanupService] Cleanup error:', error);
			throw error;
		}
	}

	async cleanupReminder(firestoreId, reminder, localId) {
		try {
			// Cancel local notification if it exists
			if (localId) {
				await Notifications.cancelScheduledNotificationAsync(localId);
			}

			// Create history entry if reminder was completed or had notes
			if (reminder?.status === 'completed' || reminder?.notes_added) {
				const historyEntry = {
					date: new Date().toISOString(),
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

	getCleanupStats() {
		return {
			...this.cleanupStats,
			initialized: this.initialized,
			lastCleanupTime: this.lastCleanupTime,
		};
	}
}

export const cleanupService = new CleanupService();
