import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../config/firebase';
import { DateTime } from 'luxon';
import { cacheManager } from './cache';
import { REMINDER_STATUS, NOTIFICATION_TYPES } from '../../constants/notifications';

const PATTERN_WEIGHTS = {
	CALL_ATTEMPTS: 1.0,
	SNOOZE_PATTERNS: 0.7,
	SKIP_PATTERNS: 0.5,
	TIME_OF_DAY: 0.8,
	DAY_OF_WEEK: 0.6,
};

const CACHE_KEYS = {
	PATTERN_DATA: 'pattern_data_',
	SCHEDULING_HISTORY: 'scheduling_history_',
};

class SchedulingHistoryService {
	constructor() {
		this.patternData = null;
		this.userId = null;
	}

	async initialize() {
		if (!auth.currentUser) return false;
		this.userId = auth.currentUser.uid;
		await this.loadPatternData();
		return true;
	}

	async loadPatternData() {
		try {
			const cachedData = await cacheManager.getSchedulingHistory(this.userId);
			if (cachedData) {
				this.patternData = cachedData;
				return;
			}

			this.patternData = {
				timeSlots: {},
				daysOfWeek: {},
				snoozePatterns: [],
				skipPatterns: [],
				successfulAttempts: [],
				lastUpdated: new Date().toISOString(),
			};

			await this.savePatternData();
		} catch (error) {
			console.error('Error loading pattern data:', error);
			throw error;
		}
	}

	async savePatternData() {
		try {
			if (!this.userId || !this.patternData) return;
			await cacheManager.saveSchedulingHistory(this.userId, this.patternData);
		} catch (error) {
			console.error('Error saving pattern data:', error);
			throw error;
		}
	}

	async trackSnooze(reminderId, fromTime, toTime, reason) {
		try {
			if (!this.patternData) await this.loadPatternData();

			const snoozeData = {
				reminderId,
				fromTime: fromTime.toISO(),
				toTime: toTime.toISO(),
				reason,
				timestamp: new Date().toISOString(),
			};

			this.patternData.snoozePatterns.push(snoozeData);
			await this.updateTimeSlotScore(fromTime, -PATTERN_WEIGHTS.SNOOZE_PATTERNS);
			await this.savePatternData();
		} catch (error) {
			console.error('Error tracking snooze:', error);
			throw error;
		}
	}

	async trackSkip(reminderId, scheduledTime) {
		try {
			if (!this.patternData) await this.loadPatternData();

			const skipData = {
				reminderId,
				scheduledTime: scheduledTime.toISO(),
				timestamp: new Date().toISO(),
			};

			this.patternData.skipPatterns.push(skipData);
			await this.updateTimeSlotScore(scheduledTime, -PATTERN_WEIGHTS.SKIP_PATTERNS);
			await this.savePatternData();
		} catch (error) {
			console.error('Error tracking skip:', error);
			throw error;
		}
	}

	async trackSuccessfulAttempt(reminderId, contactId, attemptTime) {
		try {
			if (!this.patternData) await this.loadPatternData();

			const attemptData = {
				reminderId,
				contactId,
				attemptTime: attemptTime.toISO(),
				timestamp: new Date().toISO(),
			};

			this.patternData.successfulAttempts.push(attemptData);
			await this.updateTimeSlotScore(attemptTime, PATTERN_WEIGHTS.CALL_ATTEMPTS);
			await this.updateDayOfWeekScore(attemptTime.weekday, PATTERN_WEIGHTS.DAY_OF_WEEK);
			await this.savePatternData();
		} catch (error) {
			console.error('Error tracking successful attempt:', error);
			throw error;
		}
	}

	async updateTimeSlotScore(dateTime, weight) {
		const hour = dateTime.hour;
		const timeSlot = `${hour}:00`;

		if (!this.patternData.timeSlots[timeSlot]) {
			this.patternData.timeSlots[timeSlot] = 0;
		}

		this.patternData.timeSlots[timeSlot] += weight;
	}

	async updateDayOfWeekScore(weekday, weight) {
		if (!this.patternData.daysOfWeek[weekday]) {
			this.patternData.daysOfWeek[weekday] = 0;
		}

		this.patternData.daysOfWeek[weekday] += weight;
	}

	async getPatternAnalysis() {
		try {
			if (!this.patternData) await this.loadPatternData();

			const now = DateTime.now();
			const recentSnoozes = this.patternData.snoozePatterns.filter((snooze) => {
				const snoozeDate = DateTime.fromISO(snooze.timestamp);
				return now.diff(snoozeDate, 'days').days <= 30;
			});

			const recentSkips = this.patternData.skipPatterns.filter((skip) => {
				const skipDate = DateTime.fromISO(skip.timestamp);
				return now.diff(skipDate, 'days').days <= 30;
			});

			const bestTimeSlots = Object.entries(this.patternData.timeSlots)
				.sort(([, a], [, b]) => b - a)
				.slice(0, 5);

			const bestDays = Object.entries(this.patternData.daysOfWeek).sort(([, a], [, b]) => b - a);

			return {
				preferredTimeSlots: bestTimeSlots,
				preferredDays: bestDays,
				recentSnoozeCount: recentSnoozes.length,
				recentSkipCount: recentSkips.length,
				totalSuccessfulAttempts: this.patternData.successfulAttempts.length,
				lastUpdated: this.patternData.lastUpdated,
			};
		} catch (error) {
			console.error('Error getting pattern analysis:', error);
			throw error;
		}
	}

	async clearHistory() {
		try {
			this.patternData = {
				timeSlots: {},
				daysOfWeek: {},
				snoozePatterns: [],
				skipPatterns: [],
				successfulAttempts: [],
				lastUpdated: new Date().toISOString(),
			};
			await this.savePatternData();
		} catch (error) {
			console.error('Error clearing history:', error);
			throw error;
		}
	}
}

export const schedulingHistory = new SchedulingHistoryService();
