// Constants for notifications (scheduledCalls.js and others)
export const NOTIFICATION_TYPES = {
	CONTACT_REMINDER: 'contact_reminder',
	CALL_FOLLOW_UP: 'call_follow_up',
};

export const REMINDER_STATUS = {
	PENDING: 'pending',
	COMPLETED: 'completed',
	SNOOZED: 'snoozed',
	SKIPPED: 'skipped',
};

export const REMINDER_TYPES = {
	REGULAR: 'regular',
	FOLLOW_UP: 'follow_up',
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
