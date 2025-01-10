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
