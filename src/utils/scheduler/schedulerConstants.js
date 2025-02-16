// Recurring reminder configurations
export const RECURRENCE_METADATA = {
	MIN_CONFIDENCE: 0.5, // Minimum confidence score to use patterns
	MAX_AGE_DAYS: 30, // Time window to analyze patterns
	TYPES: {
		DAILY: 'daily',
		WEEKLY: 'weekly',
		BIWEEKLY: 'biweekly',
		MONTHLY: 'monthly',
		QUARTERLY: 'quarterly',
		YEARLY: 'yearly',
	},
};

export const MAX_AGE_DAYS = RECURRENCE_METADATA?.MAX_AGE_DAYS || 30;

if (!RECURRENCE_METADATA?.MAX_AGE_DAYS) {
	console.warn('MAX_AGE_DAYS not found in RECURRENCE_METADATA, using fallback value of 30');
}

export const FREQUENCY_OPTIONS = [
	{ label: 'Daily', value: RECURRENCE_METADATA.TYPES.DAILY },
	{ label: 'Weekly', value: RECURRENCE_METADATA.TYPES.WEEKLY },
	{ label: 'Bi-Weekly', value: RECURRENCE_METADATA.TYPES.BIWEEKLY },
	{ label: 'Monthly', value: RECURRENCE_METADATA.TYPES.MONTHLY },
	{ label: 'Quarterly', value: RECURRENCE_METADATA.TYPES.QUARTERLY },
	{ label: 'Yearly', value: RECURRENCE_METADATA.TYPES.YEARLY },
];

export const FREQUENCY_MAPPINGS = {
	daily: 1,
	weekly: 7,
	biweekly: 14,
	monthly: 30,
	quarterly: 90,
	yearly: 365,
};

export const PRIORITY_OPTIONS = [
	{ label: 'Low', value: 'low' },
	{ label: 'Normal', value: 'normal' },
	{ label: 'High', value: 'high' },
];

export const PRIORITY_FLEXIBILITY = {
	high: 1,
	normal: 3,
	low: 5,
};

export const BLOCKED_TIMES = [
	{ hour: 9, minute: 0 },
	{ hour: 15, minute: 0 },
	{ hour: 18, minute: 0 },
];

export const TIME_BUFFER = 5;
export const TIME_SLOT_INTERVAL = 15;
export const MAX_ATTEMPTS = 32;

export const DAYS_OF_WEEK = [
    { label: 'S', value: 'sunday' },
    { label: 'M', value: 'monday' },
    { label: 'T', value: 'tuesday' },
    { label: 'W', value: 'wednesday' },
    { label: 'T', value: 'thursday' },
    { label: 'F', value: 'friday' },
    { label: 'S', value: 'saturday' },
];

export const DEFAULT_ACTIVE_HOURS = {
	start: '09:00',
	end: '17:00',
};

export const TIME_DISPLAY = {
	FORMAT: {
		HOUR_ONLY: 'HH:00',
		HOUR_MINUTE: 'HH:mm',
	},
	PERIODS: {
		AM: 'AM',
		PM: 'PM',
	},
};
