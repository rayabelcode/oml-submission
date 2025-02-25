import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

const ThemeContext = createContext();

export const spacing = {
	xxs: 2,
	xs: 5,
	sm: 10,
	md: 15,
	lg: 20,
	xl: 30,
	xxl: 40,
	xxxl: 50,
};

export const layout = {
	borderRadius: {
		xs: 4,
		sm: 8,
		md: 10,
		lg: 15,
		xl: 20,
		xxl: 25,
		xxxl: 30,
		circle: 50,
	},
};

const tagColors = {
	light: {
		blue: '#E8F3FF', // Light Blue
		green: '#E6F6ED', // Light Green
		purple: '#F3E8FF', // Light Purple
		orange: '#FFF1E6', // Light Orange
		pink: '#FCE8FF', // Light Pink
		yellow: '#FFF9E6', // Light Yellow
	},
	dark: {
		blue: '#1A2733', // Dark Blue
		green: '#1A2B22', // Dark Green
		purple: '#261A33', // Dark Purple
		orange: '#332B1A', // Dark Orange
		pink: '#331A2B', // Dark Pink
		yellow: '#332E1A', // Dark Yellow
	},
};

const lightTheme = {
	background: {
		primary: '#FFFFFF', // White
		secondary: '#F2F2F7', // Light Gray
		tertiary: '#E5E5EA', // Light Gray
		quaternary: '#F5F5F5', // Light Gray
		overlay: 'rgba(0, 0, 0, 0.75)', // Black with 75% opacity
		statusBar: 'transparent', // Transparent
		whiteText: '#1A1B1C', // Black
	},
	text: {
		primary: '#000000', // Black
		secondary: '#666666', // Dark Gray
		subtleText: '#E5E5EA', // Light Gray
		lightWarning: '#2e2b2a', // Dark Gray
		white: '#FFFFFF', //
	},
	buttons: {
		activeIcon: '#4CD964', // Green
		inactiveIcon: '#007AFF', // Blue
	},
	primary: '#007AFF', // Blue
	secondary: '#4CD964', // Green
	danger: '#FF3B30', // Red
	warning: '#FF9500', // Orange
	lightWarning: '#fa6b7e', // Light Red
	lightHighlight: '#87EF66', // Light Green
	success: '#34C759', // Green
	border: '#E5E5EA', // Light Gray
	tabBar: {
		background: '#E0E0E0', // Light Gray
	},
	reminderTypes: {
		follow_up: '#E6F3FF', // Light Blue
		scheduled: '#E6FFE6', // Light Green
		custom_date: '#F5E6FF', // Light Purple
	},
	tags: tagColors.light, // Light theme tag colors
};

const darkTheme = {
	background: {
		primary: '#000000', // Black
		secondary: '#1C1C1E', // Dark Gray
		tertiary: '#2C2C2E', //	Dark Gray
		quaternary: '#3A3A3C', // Dark Gray
		overlay: 'rgba(0, 0, 0, 0.9)', // Black with 90% opacity
		statusBar: 'transparent', // Transparent
		whiteText: '#000000', // Black
	},
	text: {
		primary: '#FFFFFF', // White
		secondary: '#8E8E93', // Light Gray
		subtleText: '#1C1C1E', // Dark Gray
		lightWarning: '#bab8b8', // Light Gray
		white: '#FFFFFF', // White
	},
	buttons: {
		activeIcon: '#30D158', // Green
		inactiveIcon: '#0A84FF', // Blue
	},
	primary: '#0A84FF', // Blue
	secondary: '#30D158', // Green
	danger: '#FF453A', // Red
	warning: '#FFD60A', // Orange
	lightWarning: '#75150D', // Light Red
	lightHighlight: '#0A5A18', // Light Green
	success: '#32D74B', // Green
	border: '#3A3A3C', // Dark Gray
	tabBar: {
		background: '#2C2C2E', // Dark Gray
	},
	reminderTypes: {
		follow_up: '#1C2733', // Light Blue
		scheduled: '#1C291C', // Light Green
		custom_date: '#291C33', //
	},
	tags: tagColors.dark, // Dark theme tag colors
};

const dimmedTheme = {
	background: {
		primary: '#1A1A1A', // Dark Gray
		secondary: '#2D2D2D', // Light Gray
		tertiary: '#404040', // Dark Gray
		quaternary: '#4D4D4D', // Dark Gray
		overlay: 'rgba(0, 0, 0, 0.85)', // Black with 85% opacity
		statusBar: 'transparent', // Transparent
		whiteText: '#000000', // Black
	},
	text: {
		primary: '#E0E0E0', // Light Gray
		secondary: '#A0A0A0', // Light Gray
		subtleText: '#2D2D2D', // Light Gray
		lightWarning: '#D0D0D0', // Light Gray
		white: '#FFFFFF', //	 White
	},
	buttons: {
		activeIcon: '#34D399', // Green
		inactiveIcon: '#3B82F6', // Blue
	},
	primary: '#3B82F6', // Blue
	secondary: '#34D399', // Green
	danger: '#EF4444', // Red
	warning: '#F59E0B', // Orange
	lightWarning: '#92400E', // Light Red
	lightHighlight: '#065F46', // Light Green
	success: '#10B981', // Green
	border: '#404040', // Dark Gray
	tabBar: {
		background: '#333333', // Dark Gray
	},
	reminderTypes: {
		follow_up: '#1E3A8A', // Light Blue
		scheduled: '#064E3B', // Light Green
		custom_date: '#3D1B40', // Light Purple
	},
	tags: tagColors.dark, // Dark theme tag colors
};

export function ThemeProvider({ children }) {
	const systemTheme = useColorScheme();
	const [userTheme, setUserTheme] = useState('system');

	useEffect(() => {
		AsyncStorage.getItem('theme').then((savedTheme) => {
			if (savedTheme) setUserTheme(savedTheme);
		});
	}, []);

	// Calculate the theme based on user selection and system setting
	const effectiveTheme = React.useMemo(() => {
		if (userTheme === 'system') {
			return systemTheme === 'dark' ? 'dark' : 'light';
		}
		return userTheme;
	}, [userTheme, systemTheme]);

	// Get the correct color theme based on theme
	const colors = React.useMemo(() => {
		switch (effectiveTheme) {
			case 'dark':
				return darkTheme;
			case 'dimmed':
				return dimmedTheme;
			case 'light':
				return lightTheme;
			default:
				return lightTheme;
		}
	}, [effectiveTheme]);

	const setThemeValue = async (newTheme) => {
		setUserTheme(newTheme);
		await AsyncStorage.setItem('theme', newTheme);
	};

	return (
		<ThemeContext.Provider
			value={{
				theme: userTheme,
				effectiveTheme,
				setThemeValue,
				colors,
				spacing,
				layout,
			}}
		>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error('useTheme must be used within a ThemeProvider');
	}
	return context;
}
