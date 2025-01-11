export const RELATIONSHIP_TYPES = {
	family: {
		label: 'Family',
		icon: 'home',
		color: '#4A90E2', // Blue
	},
	friend: {
		label: 'Friend',
		icon: 'person',
		color: '#9C27B0', // Purple
	},
	work: {
		label: 'Work',
		icon: 'briefcase',
		color: '#4CAF50', // Green
	},
	personal: {
		label: 'Personal',
		icon: 'heart',
		color: '#E26B6B', // Red
	},
};

export const RELATIONSHIP_TYPE_ARRAY = Object.keys(RELATIONSHIP_TYPES);

export const DEFAULT_RELATIONSHIP_TYPE = 'friend';

export const RELATIONSHIP_DEFAULTS = {
	active_hours: {
		work: { start: '09:00', end: '17:00' },
		personal: { start: '16:00', end: '21:00' },
		family: { start: '10:00', end: '19:00' },
		friend: { start: '16:00', end: '21:00' },
	},
	preferred_days: {
		work: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
		personal: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
		family: ['saturday', 'sunday'],
		friend: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
	},
	excluded_times: {
		work: [
			{
				days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
				start: '12:00',
				end: '13:00',
			},
		],
		personal: [],
		family: [],
		friend: [],
	},
};
