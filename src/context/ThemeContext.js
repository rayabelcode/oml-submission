import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
		overlay: 'rgba(0, 0, 0, 0.75)',
	},
	text: {
		primary: '#000000',
		secondary: '#666666',
	},
	primary: '#007AFF',
	secondary: '#4CD964',
	danger: '#FF3B30',
	warning: '#FFCC00',
	success: '#34C759',
	border: '#FFFFFF',
};

//Dark Color Theme
const darkTheme = {
	background: {
		primary: '#000000',
		secondary: '#1C1C1E',
		tertiary: '#2C2C2E',
		overlay: 'rgba(0, 0, 0, 0.9)',
	},
	text: {
		primary: '#FFFFFF',
		secondary: '#8E8E93',
	},
	primary: '#0A84FF',
	secondary: '#30D158',
	danger: '#FF453A',
	warning: '#FFD60A',
	success: '#32D74B',
	border: '#3A3A3C',
};

export function ThemeProvider({ children }) {
	const [theme, setTheme] = useState('light');

	useEffect(() => {
		// Load saved theme preference
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

	return <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error('useTheme must be used within a ThemeProvider');
	}
	return context;
}
