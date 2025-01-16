import { Timestamp } from 'firebase/firestore';

export const REMINDER_TYPES = {
	SCHEDULED: 'scheduled',
	FOLLOW_UP: 'call_follow_up',
};

export const REMINDER_STATUS = {
	PENDING: 'pending',
	COMPLETED: 'completed',
	SNOOZED: 'snoozed',
	SKIPPED: 'skipped',
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
export const NOTIFICATION_MAP_KEY = 'notification_map';

export const NOTIFICATION_MESSAGES = {
	MAX_SNOOZE_REACHED: {
		title: 'Maximum Snooze Reached',
		message: 'You have snoozed this reminder 4 times. Would you like to skip this call?',
	},
	CONTACT_ACTION: {
		title: 'Choose an action:',
	},
};
