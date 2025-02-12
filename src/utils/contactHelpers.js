import { serverTimestamp } from 'firebase/firestore';
import { formatBirthday } from './dateHelpers';
import {
	RELATIONSHIP_TYPES,
	RELATIONSHIP_DEFAULTS,
	DEFAULT_RELATIONSHIP_TYPE,
} from '../../constants/relationships';

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
	// Destructure all expected fields including birthday
	try {
		const { relationship_type, phone, birthday, ...cleanedBasicData } = basicData;

		const contactType = relationship_type || DEFAULT_RELATIONSHIP_TYPE;

		// Format birthday, but don't let it break the contact creation
		let formattedBirthday = null;
		try {
			formattedBirthday = formatBirthday(birthday);
		} catch (error) {
			console.error('Error formatting birthday during contact creation:', error);
		}

		return {
			...cleanedBasicData,
			phone: standardizePhoneNumber(phone),
			birthday: formattedBirthday,
			archived: false,
			notes: '',
			contact_history: [],
			tags: [],
			next_contact: null,
			created_at: serverTimestamp(),
			last_updated: serverTimestamp(),
			user_id: userId,
			scheduling: {
				relationship_type: contactType,
				frequency: SCHEDULING_CONSTANTS.FREQUENCIES.WEEKLY,
				custom_schedule: false,
				priority: SCHEDULING_CONSTANTS.PRIORITIES.NORMAL,
				minimum_gap: 30,
				custom_preferences: {
					preferred_days: RELATIONSHIP_DEFAULTS.preferred_days[contactType],
					active_hours: RELATIONSHIP_DEFAULTS.active_hours[contactType],
					excluded_times: RELATIONSHIP_DEFAULTS.excluded_times[contactType],
				},
			},
		};
	} catch (error) {
		console.error('Error creating contact data:', error);
		throw new Error('Failed to create contact data');
	}
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
