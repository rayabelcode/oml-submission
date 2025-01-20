import { Timestamp } from 'firebase/firestore';

export const NOTIFICATION_MAP_KEY = 'notification_map';

export const REMINDER_TYPES = {
	SCHEDULED: 'scheduled',
	FOLLOW_UP: 'follow_up',
};

export const REMINDER_STATUS = {
	PENDING: 'pending',
	COMPLETED: 'completed',
	SNOOZED: 'snoozed',
	SKIPPED: 'skipped',
};

// Recurring reminder configurations
export const RECURRENCE_METADATA = {
	MIN_CONFIDENCE: 0.5, // Minimum confidence score to use patterns
	TYPES: {
		DAILY: 'daily',
		WEEKLY: 'weekly',
		BIWEEKLY: 'biweekly',
		MONTHLY: 'monthly',
		QUARTERLY: 'quarterly',
		YEARLY: 'yearly',
	},
};

// iOS specific configurations
export const IOS_CONFIGS = {
	NOTIFICATION_SETTINGS: {
		// iOS foreground presentation options
		FOREGROUND: {
			alert: true,
			badge: true,
			sound: true,
		},
		// iOS background fetch settings
		BACKGROUND: {
			fetchInterval: 15 * 60, // 15 minutes in seconds
		},
		// iOS specific notification categories
		CATEGORIES: {
			FOLLOW_UP: {
				identifier: 'follow_up',
				actions: [
					{
						identifier: 'add_notes',
						title: 'Add Notes',
						options: {
							foreground: true,
							destructive: false,
						},
					},
					{
						identifier: 'dismiss',
						title: 'Dismiss',
						options: {
							foreground: false,
							destructive: true,
						},
					},
				],
			},
			SCHEDULED: {
				identifier: 'scheduled',
				actions: [
					{
						identifier: 'call_now',
						title: 'Call Now',
						options: {
							foreground: true,
						},
					},
					{
						identifier: 'snooze',
						title: 'Snooze',
						options: {
							foreground: true,
						},
					},
				],
			},
		},
	},
};

// Enhanced notification configurations
export const NOTIFICATION_CONFIGS = {
	FOLLOW_UP: {
		DELAY: 0, // immediate for now
		TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours until auto-cleanup
		CLEANUP: {
			TRIGGERS: ['notes_added', 'dismissed', 'timeout'],
			ACTIONS: {
				notes_added: 'archive',
				dismissed: 'delete',
				timeout: 'archive',
			},
		},
	},
	SCHEDULED: {
		MIN_ADVANCE: 0, // minimum 0 minutes advance
		MAX_ADVANCE: 7 * 24 * 60 * 60 * 1000, // maximum 7 days advance
		CLEANUP: {
			TRIGGERS: ['completed', 'skipped', 'expired'],
			ACTIONS: {
				completed: 'archive',
				skipped: 'delete',
				expired: 'archive',
			},
		},
	},
};

// Error handling configurations
export const ERROR_HANDLING = {
	RETRY: {
		MAX_ATTEMPTS: 3,
		INTERVALS: [1000, 5000, 15000], // Retry delays in ms
		PUSH: {
			MAX_ATTEMPTS: 3,
			INTERVALS: [2000, 10000, 30000], // Push-specific retry delays
			BACKOFF_RATE: 2, // Exponential backoff multiplier
			JITTER: 1000, // Random delay (ms) to prevent thundering herd
			ERROR_CODES: {
				INVALID_TOKEN: 'InvalidToken',
				RATE_LIMIT: 'RateLimit',
				NETWORK_ERROR: 'NetworkError',
				SERVER_ERROR: 'ServerError',
			},
		},
	},
};

// Notification coordinator settings
export const COORDINATOR_CONFIG = {
	BATCH_SIZE: 50,
	CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 hour
	SYNC_INTERVAL: 15 * 60 * 1000, // 15 minutes
	STORAGE_KEYS: {
		NOTIFICATION_MAP: NOTIFICATION_MAP_KEY,
		PENDING_QUEUE: '@PendingNotifications',
		LAST_CLEANUP: '@LastCleanupTime',
		LAST_SYNC: '@LastSyncTime',
	},
};

// Default notification format
export const REMINDER_SCHEMA = {
	contact_id: String,
	user_id: String,
	type: String, // REMINDER_TYPES.SCHEDULED or REMINDER_TYPES.FOLLOW_UP
	status: String, // 'pending', 'completed', 'snoozed', 'skipped'
	scheduledTime: Timestamp,
	created_at: Timestamp,
	updated_at: Timestamp,
	contactName: String,
	notes_added: Boolean,
	needs_attention: Boolean,
	snoozed: Boolean,
	snooze_history: Array, // Optional
	call_data: Object, // Optional
};

export const SNOOZE_OPTIONS = [
	{
		id: 'later_today',
		icon: 'time-outline',
		text: 'Later Today (+3 hours)',
		hours: 3,
	},
	{
		id: 'tomorrow',
		icon: 'calendar-outline',
		text: 'Tomorrow',
		days: 1,
	},
	{
		id: 'next_week',
		icon: 'calendar-outline',
		text: 'Next Week',
		days: 7,
	},
	{
		id: 'skip',
		icon: 'close-circle-outline',
		text: 'Skip This Call',
		type: 'skip',
	},
];

export const PATTERN_TRACKING = {
	TIME_WINDOW: {
		DEFAULT: 90, // 3 months default days to analyze
		MIN: 30, // Minimum days to analyze
		MAX: 365, // Maximum days to analyze
	},
	MIN_ATTEMPTS: {
		DEFAULT: 3, // Default minimum attempts before using patterns
		BY_FREQUENCY: {
			weekly: 3,
			biweekly: 2,
			monthly: 2,
			bimonthly: 1,
			quarterly: 1,
		},
	},
	WEIGHTS: {
		COMPLETION: 1.0,
		SNOOZE: 0.7,
		SKIP: -0.5,
		TIME_OF_DAY: 0.8,
		RECENCY: {
			LAST_WEEK: 1.0,
			LAST_MONTH: 0.8,
			LAST_QUARTER: 0.5,
			OLDER: 0.3,
		},
	},
};

export const MAX_SNOOZE_ATTEMPTS = 4;

export const NOTIFICATION_MESSAGES = {
	MAX_SNOOZE_REACHED: {
		title: 'Maximum Snooze Reached',
		message: 'You have snoozed this reminder 4 times. Would you like to skip this call?',
	},
	CONTACT_ACTION: {
		title: 'Choose an action:',
	},
};
