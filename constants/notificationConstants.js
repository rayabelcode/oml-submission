import { Timestamp } from 'firebase/firestore';

export const NOTIFICATION_MAP_KEY = 'notification_map';

export const REMINDER_TYPES = {
	SCHEDULED: 'SCHEDULED',
	FOLLOW_UP: 'FOLLOW_UP',
	CUSTOM_DATE: 'CUSTOM_DATE',
};

export const REMINDER_STATUS = {
	PENDING: 'pending',
	SENT: 'sent',
	SNOOZED: 'snoozed',
	SKIPPED: 'skipped',
	COMPLETED: 'completed',
};

// Notification trigger validation
export const NOTIFICATION_VALIDATION = {
	validateTrigger: (trigger) => {
		if (trigger instanceof Date) return trigger;
		if (typeof trigger === 'string') return new Date(trigger);
		if (trigger?.date) return new Date(trigger.date);
		if (trigger?.seconds) return new Date(Date.now() + trigger.seconds * 1000);
		throw new Error('Invalid notification trigger format');
	},
};

// Display names for reminder types
export const FREQUENCY_DISPLAY_MAP = {
	weekly: 'Weekly',
	biweekly: 'Bi-Weekly',
	monthly: 'Monthly',
	bimonthly: 'Bi-Monthly',
	quarterly: 'Quarterly',
	yearly: 'Yearly',
	daily: 'Daily',
	custom: 'Custom',
};

// Default max snooze options
export const DEFAULT_MAX_SNOOZE_ATTEMPTS = 5;

// Max snooze attempts by frequency
export const FREQUENCY_SNOOZE_LIMITS = {
	daily: 1,
	weekly: 3,
	biweekly: 4,
	monthly: DEFAULT_MAX_SNOOZE_ATTEMPTS,
	quarterly: DEFAULT_MAX_SNOOZE_ATTEMPTS,
	yearly: DEFAULT_MAX_SNOOZE_ATTEMPTS,
	default: DEFAULT_MAX_SNOOZE_ATTEMPTS,
};

// Snooze indicator constants
export const SNOOZE_INDICATORS = {
	NORMAL: 'normal',
	WARNING: 'warning',
	CRITICAL: 'critical',
};

// Message constants for snooze limits
export const SNOOZE_LIMIT_MESSAGES = {
	REMAINING: (count) => `${count} snooze${count !== 1 ? 's' : ''} remaining`,
	LAST_REMAINING: 'This is your last available snooze',
	MAX_REACHED: 'Maximum Snoozes Reached',
	DAILY_LIMIT: null,
	WEEKLY_LIMIT: null,
	DAILY_MAX_REACHED: 'Your daily notifications for this call will continue tomorrow if you skip.',
	RECURRING_MAX_REACHED: "You've snoozed this often, want to reschedule?",
	OPTION_UNAVAILABLE: 'This option is not available for this type of reminder',
};

// Notification action types
export const OPTION_TYPES = {
	CONTACT_NOW: 'contact_now',
	RESCHEDULE: 'reschedule'
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
				identifier: 'FOLLOW_UP',
				actions: [
					{
						identifier: 'add_notes',
						title: 'Add Notes',
						textInput: {
							buttonTitle: 'Save',
							placeholder: 'Enter your call notes...',
						},
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

			CUSTOM_DATE: {
				identifier: 'CUSTOM_DATE',
				actions: [
					{
						identifier: 'call_now',
						title: 'Contact Now',
						options: {
							isDestructive: false,
							isAuthenticationRequired: false,
						},
					},
					{
						identifier: 'snooze',
						title: 'Snooze',
						options: {
							isDestructive: false,
							isAuthenticationRequired: false,
						},
					},
				],
			},

			SCHEDULED: {
				identifier: 'SCHEDULED',
				actions: [
					{
						identifier: 'call_now',
						title: 'Contact Now',
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

export const REMINDER_SCHEMA = {
	contact_id: String, // Reference to the contact this reminder is for
	user_id: String, // Reference to the user who owns this reminder
	type: String, // SCHEDULED or FOLLOW_UP
	status: String, // pending, completed, snoozed, or skipped
	scheduledTime: Timestamp, // When the notification should trigger
	created_at: Timestamp, // When this reminder was created
	updated_at: Timestamp, // Last time this reminder was modified
	contactName: String, // Display name for the contact
	notes_added: Boolean, // Whether notes were added after the call
	needs_attention: Boolean, // Flag for follow-ups requiring action
	snoozed: Boolean, // Whether reminder has been snoozed
	snooze_history: Array, // List of previous snooze actions
	call_data: Object, // Optional metadata about the call (duration, etc)
};

export const SNOOZE_OPTIONS = [
	{
		id: 'later_today',
		icon: 'time-outline',
		text: 'Later Today',
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
		icon: 'calendar-clear-outline',
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

export const NOTIFICATION_MESSAGES = {
	MAX_SNOOZE_REACHED: {
		title: 'Maximum Snooze Reached',
		message:
			'You have reached the maximum number of snoozes for this reminder. Would you like to skip this contact?',
	},
	CONTACT_ACTION: {
		title: 'Choose an action:',
	},
};
