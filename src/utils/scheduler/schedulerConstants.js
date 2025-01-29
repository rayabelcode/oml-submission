export const MAX_AGE_DAYS = RECURRENCE_METADATA?.MAX_AGE_DAYS || 30;

if (!RECURRENCE_METADATA?.MAX_AGE_DAYS) {
	console.warn('MAX_AGE_DAYS not found in RECURRENCE_METADATA, using fallback value of 30');
}

export const FREQUENCY_MAPPINGS = {
	daily: 1,
	weekly: 7,
	biweekly: 14,
	monthly: 30,
	quarterly: 90,
	yearly: 365,
};

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
