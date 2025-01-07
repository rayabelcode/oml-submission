import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEYS = {
	CONTACTS: 'cached_contacts_',
	UPCOMING_CONTACTS: 'cached_upcoming_contacts_',
	REMINDERS: 'cached_reminders_',
	CONTACT_HISTORY: 'cached_history_',
	PROFILE: 'cached_profile_',
	STATS: 'cached_stats_',
	LAST_UPDATED: 'last_updated_',
};

const CACHE_EXPIRY = 1000 * 60 * 60; // 1 hour in milliseconds

export const cacheManager = {
	async saveContacts(userId, contacts) {
		try {
			await AsyncStorage.setItem(CACHE_KEYS.CONTACTS + userId, JSON.stringify(contacts));
			await this.updateLastUpdated(userId, CACHE_KEYS.CONTACTS);
		} catch (error) {
			console.error('Error caching contacts:', error);
		}
	},

	async saveUpcomingContacts(userId, contacts) {
		try {
			await AsyncStorage.setItem(CACHE_KEYS.UPCOMING_CONTACTS + userId, JSON.stringify(contacts));
			await this.updateLastUpdated(userId, CACHE_KEYS.UPCOMING_CONTACTS);
		} catch (error) {
			console.error('Error caching upcoming contacts:', error);
		}
	},

	async saveReminders(userId, reminders) {
		try {
			await AsyncStorage.setItem(CACHE_KEYS.REMINDERS + userId, JSON.stringify(reminders));
			await this.updateLastUpdated(userId, CACHE_KEYS.REMINDERS);
		} catch (error) {
			console.error('Error caching reminders:', error);
		}
	},

	async saveContactHistory(contactId, history) {
		try {
			await AsyncStorage.setItem(CACHE_KEYS.CONTACT_HISTORY + contactId, JSON.stringify(history));
			await this.updateLastUpdated(contactId, CACHE_KEYS.CONTACT_HISTORY);
		} catch (error) {
			console.error('Error caching contact history:', error);
		}
	},

	async saveProfile(userId, profileData) {
		try {
			await AsyncStorage.setItem(CACHE_KEYS.PROFILE + userId, JSON.stringify(profileData));
			await this.updateLastUpdated(userId, CACHE_KEYS.PROFILE);
		} catch (error) {
			console.error('Error caching profile:', error);
		}
	},

	async saveStats(userId, stats) {
		try {
			await AsyncStorage.setItem(CACHE_KEYS.STATS + userId, JSON.stringify(stats));
			await this.updateLastUpdated(userId, CACHE_KEYS.STATS);
		} catch (error) {
			console.error('Error caching stats:', error);
		}
	},

	async getCachedContacts(userId) {
		try {
			const cached = await AsyncStorage.getItem(CACHE_KEYS.CONTACTS + userId);
			if (await this.isCacheValid(userId, CACHE_KEYS.CONTACTS)) {
				return cached ? JSON.parse(cached) : null;
			}
			return null;
		} catch (error) {
			console.error('Error getting cached contacts:', error);
			return null;
		}
	},

	async getCachedUpcomingContacts(userId) {
		try {
			const cached = await AsyncStorage.getItem(CACHE_KEYS.UPCOMING_CONTACTS + userId);
			if (await this.isCacheValid(userId, CACHE_KEYS.UPCOMING_CONTACTS)) {
				return cached ? JSON.parse(cached) : null;
			}
			return null;
		} catch (error) {
			console.error('Error getting cached upcoming contacts:', error);
			return null;
		}
	},

	async getCachedReminders(userId) {
		try {
			const cached = await AsyncStorage.getItem(CACHE_KEYS.REMINDERS + userId);
			if (await this.isCacheValid(userId, CACHE_KEYS.REMINDERS)) {
				return cached ? JSON.parse(cached) : null;
			}
			return null;
		} catch (error) {
			console.error('Error getting cached reminders:', error);
			return null;
		}
	},

	async getCachedContactHistory(contactId) {
		try {
			const cached = await AsyncStorage.getItem(CACHE_KEYS.CONTACT_HISTORY + contactId);
			if (await this.isCacheValid(contactId, CACHE_KEYS.CONTACT_HISTORY)) {
				return cached ? JSON.parse(cached) : null;
			}
			return null;
		} catch (error) {
			console.error('Error getting cached contact history:', error);
			return null;
		}
	},

	async getCachedProfile(userId) {
		try {
			const cached = await AsyncStorage.getItem(CACHE_KEYS.PROFILE + userId);
			if (await this.isCacheValid(userId, CACHE_KEYS.PROFILE)) {
				return cached ? JSON.parse(cached) : null;
			}
			return null;
		} catch (error) {
			console.error('Error getting cached profile:', error);
			return null;
		}
	},

	async getCachedStats(userId) {
		try {
			const cached = await AsyncStorage.getItem(CACHE_KEYS.STATS + userId);
			if (await this.isCacheValid(userId, CACHE_KEYS.STATS)) {
				return cached ? JSON.parse(cached) : null;
			}
			return null;
		} catch (error) {
			console.error('Error getting cached stats:', error);
			return null;
		}
	},

	async updateLastUpdated(id, cacheType) {
		try {
			await AsyncStorage.setItem(CACHE_KEYS.LAST_UPDATED + cacheType + id, new Date().toISOString());
		} catch (error) {
			console.error('Error updating last updated timestamp:', error);
		}
	},

	async isCacheValid(id, cacheType) {
		try {
			const lastUpdated = await AsyncStorage.getItem(CACHE_KEYS.LAST_UPDATED + cacheType + id);
			if (!lastUpdated) return false;

			const lastUpdatedTime = new Date(lastUpdated).getTime();
			const now = new Date().getTime();
			return now - lastUpdatedTime < CACHE_EXPIRY;
		} catch (error) {
			console.error('Error checking cache validity:', error);
			return false;
		}
	},

	async clearCache(userId) {
		try {
			const keys = await AsyncStorage.getAllKeys();
			const userCacheKeys = keys.filter(
				(key) => key.includes(userId) || key.includes(CACHE_KEYS.LAST_UPDATED)
			);
			await AsyncStorage.multiRemove(userCacheKeys);
		} catch (error) {
			console.error('Error clearing cache:', error);
		}
	},

	async clearSpecificCache(userId, cacheType) {
		try {
			await AsyncStorage.removeItem(cacheType + userId);
			await AsyncStorage.removeItem(CACHE_KEYS.LAST_UPDATED + cacheType + userId);
		} catch (error) {
			console.error('Error clearing specific cache:', error);
		}
	},

	async clearProfileCache(userId) {
		try {
			await AsyncStorage.removeItem(CACHE_KEYS.PROFILE + userId);
			await AsyncStorage.removeItem(CACHE_KEYS.LAST_UPDATED + CACHE_KEYS.PROFILE + userId);
		} catch (error) {
			console.error('Error clearing profile cache:', error);
		}
	},
};
