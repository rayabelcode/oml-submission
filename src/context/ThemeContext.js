import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

const ThemeContext = createContext();

// Object Spacing
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

//Light Color Theme
const lightTheme = {
	background: {
		primary: '#FFFFFF',
		secondary: '#F2F2F7',
		tertiary: '#E5E5EA',
		quaternary: '#F5F5F5',
		overlay: 'rgba(0, 0, 0, 0.75)',
		statusBar: 'transparent',
	},
	text: {
		primary: '#000000',
		secondary: '#666666',
		subtleText: '#E5E5EA', // Slightly darker than background.primary
		lightWarning: '#2e2b2a',
	},
	primary: '#007AFF',
	secondary: '#4CD964',
	danger: '#FF3B30',
	warning: '#FF9500',
	lightWarning: '#fa6b7e', // Lighter red warning
	lightHighlight: '#87EF66', // Lighter green success
	success: '#34C759',
	border: '#E5E5EA',
	tabBar: {
		background: '#E0E0E0',
	},
	reminderTypes: {
		follow_up: '#E6F3FF', // Light blue
		scheduled: '#E6FFE6', // Light green
		custom_date: '#F5E6FF', // Light purple
	},
};

//Dark Color Theme
const darkTheme = {
	background: {
		primary: '#000000',
		secondary: '#1C1C1E',
		tertiary: '#2C2C2E',
		quaternary: '#3A3A3C',
		overlay: 'rgba(0, 0, 0, 0.9)',
		statusBar: 'transparent',
	},
	text: {
		primary: '#FFFFFF',
		secondary: '#8E8E93',
		subtleText: '#1C1C1E', // Slightly lighter than background.primary
		lightWarning: '#bab8b8',
	},
	primary: '#0A84FF',
	secondary: '#30D158',
	danger: '#FF453A',
	warning: '#FFD60A',
	lightWarning: '#75150D', // Lighter red warning
	lightHighlight: '#0A5A18', // Lighter green success
	success: '#32D74B',
	border: '#3A3A3C',
	tabBar: {
		background: '#2C2C2E',
	},
	reminderTypes: {
		follow_up: '#1C2733', // Dark blue
		scheduled: '#1C291C', // Dark green
		custom_date: '#291C33', // Dark purple
	},
};

export function ThemeProvider({ children }) {
	const colorScheme = useColorScheme();
	const [theme, setTheme] = useState(colorScheme || 'light');

	useEffect(() => {
		const loadTheme = async () => {
			try {
				const savedTheme = await AsyncStorage.getItem('theme');
				if (savedTheme) {
					setTheme(savedTheme);
				}
			} catch (error) {
				console.error('Error loading theme:', error);
			}
		};
		loadTheme();
	}, []);

	const toggleTheme = async () => {
		const newTheme = theme === 'light' ? 'dark' : 'light';
		setTheme(newTheme);
		try {
			await AsyncStorage.setItem('theme', newTheme);
		} catch (error) {
			console.error('Error saving theme:', error);
		}
	};

	const colors = theme === 'light' ? lightTheme : darkTheme;

	return (
		<ThemeContext.Provider value={{ theme, toggleTheme, colors, spacing, layout }}>
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
