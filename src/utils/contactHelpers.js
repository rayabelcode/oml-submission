import { serverTimestamp } from 'firebase/firestore';

export const SCHEDULING_CONSTANTS = {
	FREQUENCIES: {
		DAILY: 'daily',
		WEEKLY: 'weekly',
		BIWEEKLY: 'biweekly',
		MONTHLY: 'monthly',
		BIMONTHLY: 'bimonthly',
		QUARTERLY: 'quarterly',
		SEMIANNUALLY: 'semiannually',
		ANNUALLY: 'annually',
	},
	PRIORITIES: {
		LOW: 'low',
		NORMAL: 'normal',
		HIGH: 'high',
	},
	RELATIONSHIP_TYPES: ['friend', 'family', 'personal', 'work'],
};

// Helper function to format phone numbers
const formatPhoneNumber = (phone) => {
	if (!phone) return '';
	// Remove all non-numeric characters
	const cleaned = phone.replace(/\D/g, '');
	// Add +1 prefix if it's not there and the number is 10 digits
	if (cleaned.length === 10) {
		return `+1${cleaned}`;
	}
	// If it's already 11 digits with a 1 prefix, add the +
	if (cleaned.length === 11 && cleaned.startsWith('1')) {
		return `+${cleaned}`;
	}
	return phone; // Return original if it doesn't match expected formats
};

export const createContactData = (basicData, userId) => {
	// Destructure relationship_type out of basicData and create new object without it
    const { relationship_type, phone, ...cleanedBasicData } = basicData;

	const defaultScheduling = {
		relationship_type: relationship_type || SCHEDULING_CONSTANTS.RELATIONSHIP_TYPES[0],
		frequency: SCHEDULING_CONSTANTS.FREQUENCIES.WEEKLY,
		custom_schedule: false,
		priority: SCHEDULING_CONSTANTS.PRIORITIES.NORMAL,
		minimum_gap: 30,
		custom_preferences: {
			preferred_days: [],
			active_hours: {
				start: '09:00',
				end: '17:00',
			},
			excluded_times: [],
		},
	};

	return {
		...cleanedBasicData,
		phone: formatPhoneNumber(phone),
		archived: false,
		notes: '',
		contact_history: [],
		tags: [],
		next_contact: null,
		created_at: serverTimestamp(),
		last_updated: serverTimestamp(),
		user_id: userId,
		scheduling: defaultScheduling,
	};
};

export const updateContactData = (contactData) => {
	const updates = {
		...contactData,
		last_updated: serverTimestamp(),
	};

	// Remove updated_at if it exists
	if ('updated_at' in updates) {
		delete updates.updated_at;
	}

	// Move relationship_type to scheduling if it exists at root level
	if ('relationship_type' in updates && updates.scheduling) {
		updates.scheduling.relationship_type = updates.relationship_type;
		delete updates.relationship_type;
	}

	// Format phone number if it exists
	if (updates.phone) {
		updates.phone = formatPhoneNumber(updates.phone);
	}

	return updates;
};
