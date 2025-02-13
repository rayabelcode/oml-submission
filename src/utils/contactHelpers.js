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
				custom_schedule: true,
				priority: SCHEDULING_CONSTANTS.PRIORITIES.NORMAL,
				minimum_gap: 30,
				custom_preferences: {
					preferred_days: RELATIONSHIP_DEFAULTS.preferred_days[contactType],
					active_hours: RELATIONSHIP_DEFAULTS.active_hours[contactType],
					excluded_times: RELATIONSHIP_DEFAULTS.excluded_times[contactType],
				},
				recurring_next_date: null,
				custom_next_date: null,
				pattern_adjusted: false,
				confidence: null,
				snooze_count: { increment: 0 },
				scheduling_status: {
					wasRescheduled: false,
					wasSnooze: false,
				},
				status: null,
			},
		};
	} catch (error) {
		console.error('Error creating contact data:', error);
		throw new Error('Failed to create contact data');
	}
};

export const updateContactData = (contactData) => {
	if (!contactData) {
		throw new Error('Failed to update contact data');
	}

	try {
		const updates = { ...contactData };

		// Remove raw updated_at if present
		if ('updated_at' in updates) {
			delete updates.updated_at;
		}

		// Standardize scheduling fields
		if (updates.scheduling) {
			// Standardize snooze_count
			if (typeof updates.scheduling.snooze_count === 'number') {
				updates.scheduling.snooze_count = {
					increment: updates.scheduling.snooze_count,
				};
			}

			// Ensure scheduling_status exists
			if (!updates.scheduling.scheduling_status) {
				updates.scheduling.scheduling_status = {
					wasRescheduled: false,
					wasSnooze: false,
				};
			}

			// Convert dates to ISO strings if they exist
			if (updates.scheduling.recurring_next_date) {
				updates.scheduling.recurring_next_date = new Date(
					updates.scheduling.recurring_next_date
				).toISOString();
			}
			if (updates.scheduling.custom_next_date) {
				updates.scheduling.custom_next_date = new Date(updates.scheduling.custom_next_date).toISOString();
			}
		}

		// Handle relationship type updates
		if ('relationship_type' in updates && updates.scheduling) {
			updates.scheduling.relationship_type = updates.relationship_type;
			delete updates.relationship_type;
		}

		// Standardize phone if present
		if (updates.phone) {
			updates.phone = standardizePhoneNumber(updates.phone);
		}

		// Standardize next_contact if present
		if (updates.next_contact) {
			updates.next_contact = new Date(updates.next_contact).toISOString();
		}

		// Always update last_updated
		updates.last_updated = serverTimestamp();

		return updates;
	} catch (error) {
		console.error('Error updating contact data:', error);
		throw new Error('Failed to update contact data');
	}
};
