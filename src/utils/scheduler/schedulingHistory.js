import { DateTime } from 'luxon';
import { auth } from '../../config/firebase';
import { notificationCoordinator } from '../notificationCoordinator';
import { cacheManager } from '../cache';

const PATTERN_WEIGHTS = {
	CALL_ATTEMPTS: 1.0,
	SNOOZE_PATTERNS: 0.7,
	SKIP_PATTERNS: 0.5,
	TIME_OF_DAY: 0.8,
	DAY_OF_WEEK: 0.6,
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

	// Pattern learning for rescheduling
	async storeReschedulingPattern(contactId, type, timestamp, success) {
		try {
			if (!this.patternData) await this.loadPatternData();

			// Initialize contact-specific patterns if needed
			if (!this.patternData.contactPatterns) {
				this.patternData.contactPatterns = {};
			}
			if (!this.patternData.contactPatterns[contactId]) {
				this.patternData.contactPatterns[contactId] = {
					attempts: [],
					aggregatedStats: {
						byHour: {},
						byDay: {},
						byType: {},
					},
				};
			}

			const patterns = this.patternData.contactPatterns[contactId];

			const attemptData = {
				timestamp: timestamp.toISO(),
				type,
				timeOfDay: timestamp.hour,
				dayOfWeek: timestamp.weekday,
				success,
			};

			// Remove any existing attempt from the same timestamp to avoid duplicates
			patterns.attempts = patterns.attempts.filter((attempt) => attempt.timestamp !== timestamp.toISO());
			patterns.attempts.push(attemptData);

			// Reset and recalculate aggregated stats
			const stats = patterns.aggregatedStats;
			stats.byHour[timestamp.hour] = stats.byHour[timestamp.hour] || { attempts: 0, successes: 0 };
			stats.byHour[timestamp.hour].attempts++;
			if (success) stats.byHour[timestamp.hour].successes++;

			stats.byDay[timestamp.weekday] = stats.byDay[timestamp.weekday] || { attempts: 0, successes: 0 };
			stats.byDay[timestamp.weekday].attempts++;
			if (success) stats.byDay[timestamp.weekday].successes++;

			stats.byType[type] = stats.byType[type] || { attempts: 0, successes: 0 };
			stats.byType[type].attempts++;
			if (success) stats.byType[type].successes++;

			await this.savePatternData();
			return patterns;
		} catch (error) {
			console.error('Error storing rescheduling pattern:', error);
			throw error;
		}
	}

	async analyzeContactPatterns(contactId, timeWindow = 90) {
		try {
			const patterns = this.patternData?.contactPatterns?.[contactId];
			if (!patterns?.attempts) {
				return null;
			}

			const cutoffDate = DateTime.now().minus({ days: timeWindow });
			const recentAttempts = patterns.attempts.filter(
				(attempt) => DateTime.fromISO(attempt.timestamp) > cutoffDate
			);

			if (recentAttempts.length === 0) {
				return null;
			}

			// Calculate success rates
			const successRates = {
				byHour: this.calculateSuccessRates(patterns.aggregatedStats.byHour),
				byDay: this.calculateSuccessRates(patterns.aggregatedStats.byDay),
				byType: this.calculateSuccessRates(patterns.aggregatedStats.byType),
			};

			return {
				optimalTimes: Object.entries(successRates.byHour)
					.sort(([, a], [, b]) => b.score - a.score)
					.slice(0, 3),
				optimalDays: Object.entries(successRates.byDay)
					.sort(([, a], [, b]) => b.score - a.score)
					.slice(0, 3),
				successRates,
				recentAttempts: recentAttempts.length,
				confidence: this.calculateConfidenceScore(recentAttempts.length, timeWindow),
			};
		} catch (error) {
			console.error('Error analyzing contact patterns:', error);
			return null;
		}
	}

	// Time period tracking
	getTimePreference(patterns) {
		const periods = {
			morning: 0, // 6-12
			afternoon: 0, // 12-17
			evening: 0, // 17-22
		};

		patterns.forEach((pattern) => {
			const hour = pattern.timeOfDay;
			if (hour >= 6 && hour < 12) periods.morning++;
			else if (hour >= 12 && hour < 17) periods.afternoon++;
			else if (hour >= 17 && hour < 22) periods.evening++;
		});

		return periods;
	}

	calculateSuccessRates(stats) {
		return Object.entries(stats).reduce((acc, [key, data]) => {
			acc[key] = {
				successRate: data.successes / data.attempts,
				attempts: data.attempts,
			};
			return acc;
		}, {});
	}

	calculateConfidenceScore(attempts, timeWindow) {
		if (attempts === 0) return 0;

		// Calculate attempts per month (30 days)
		const monthlyRate = (attempts * 30) / timeWindow;

		// Weight components
		const frequencyWeight = Math.min(monthlyRate / 10, 1) * 0.4; // Max at 10 attempts per month
		const volumeWeight = Math.min(attempts / 20, 1) * 0.4; // Max at 20 total attempts
		const timeWeight = Math.min(timeWindow / 90, 1) * 0.2; // Max at 90 days

		// Calculate final score with proper normalization for high values
		const score = Math.min(frequencyWeight + volumeWeight + timeWeight, 1);

		return Math.round(score * 100) / 100; // Round to 2 decimal places
	}

	async suggestOptimalTime(contactId, baseTime, type) {
		try {
			const patterns = this.patternData?.contactPatterns?.[contactId];
			if (!patterns?.aggregatedStats?.byHour) {
				return null;
			}

			// Find the best hour with highest success rate
			const hourlyStats = patterns.aggregatedStats.byHour;
			const bestHourEntry = Object.entries(hourlyStats)
				.filter(([hour]) => parseInt(hour) > baseTime.hour)
				.sort(([, a], [, b]) => {
					const rateA = a.successes / a.attempts;
					const rateB = b.successes / b.attempts;
					return rateB - rateA;
				})[0];

			if (bestHourEntry) {
				return baseTime.set({ hour: parseInt(bestHourEntry[0]), minute: 0 });
			}

			// If no suitable hour found after current time, try earlier hours for next day
			const nextDayBestHour = Object.entries(hourlyStats).sort(([, a], [, b]) => {
				const rateA = a.successes / a.attempts;
				const rateB = b.successes / b.attempts;
				return rateB - rateA;
			})[0];

			if (nextDayBestHour) {
				return baseTime.plus({ days: 1 }).set({ hour: parseInt(nextDayBestHour[0]), minute: 0 });
			}

			return baseTime.plus({ hours: 3 }); // fallback
		} catch (error) {
			console.error('Error suggesting optimal time:', error);
			return null;
		}
	}
}

export const schedulingHistory = new SchedulingHistoryService();
