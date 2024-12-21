// src/styles/theme.js
export const colors = {
	primary: '#007AFF',
	secondary: '#4CAF50',
	danger: '#FF3B30',
	background: {
		primary: '#ffffff',
		secondary: '#f8f9fa',
		overlay: 'rgba(0, 0, 0, 0.5)',
	},
	border: '#eee',
	text: {
		primary: '#000000',
		secondary: '#666666',
	},
};

export const spacing = {
	xs: 5,
	sm: 10,
	md: 15,
	lg: 20,
	xl: 30,
};

export const layout = {
	borderRadius: {
		sm: 8,
		md: 10,
		lg: 15,
		circle: 50,
	},
};

// Typography styles that can be used across the app
export const typography = {
	header: {
		fontSize: 24,
		fontWeight: 'bold',
	},
	subheader: {
		fontSize: 18,
		fontWeight: '600',
	},
	body: {
		fontSize: 16,
		fontWeight: 'normal',
	},
	caption: {
		fontSize: 14,
		color: '#666666',
	},
	button: {
		fontSize: 16,
		fontWeight: '500',
	},
};
