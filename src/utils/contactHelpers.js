import { serverTimestamp } from 'firebase/firestore';
import { RELATIONSHIP_TYPES } from '../../constants/relationships';

const standardizePhoneNumber = (phone) => {
	const cleaned = phone.replace(/\D/g, '');
	if (cleaned.length === 10) {
		return `+1${cleaned}`;
	} else if (cleaned.length === 11 && cleaned.startsWith('1')) {
		return `+${cleaned}`;
	}
	return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
};

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
	RELATIONSHIP_TYPES: Object.keys(RELATIONSHIP_TYPES),
};

export const createContactData = (basicData, userId) => {
	// Destructure relationship_type out of basicData and create new object without it
	const { relationship_type, phone, ...cleanedBasicData } = basicData;

	return {
		...cleanedBasicData,
		phone: standardizePhoneNumber(phone),
		archived: false,
		notes: '',
		contact_history: [],
		tags: [],
		next_contact: null,
		created_at: serverTimestamp(),
		last_updated: serverTimestamp(),
		user_id: userId,
		scheduling: {
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
		},
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
		updates.phone = standardizePhoneNumber(updates.phone);
	}

	return updates;
};
