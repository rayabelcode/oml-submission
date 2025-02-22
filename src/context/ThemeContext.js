import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

const ThemeContext = createContext();

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

const tagColors = {
	light: {
		blue: '#E8F3FF',
		green: '#E6F6ED',
		purple: '#F3E8FF',
		orange: '#FFF1E6',
		pink: '#FCE8FF',
		yellow: '#FFF9E6',
	},
	dark: {
		blue: '#1A2733',
		green: '#1A2B22',
		purple: '#261A33',
		orange: '#332B1A',
		pink: '#331A2B',
		yellow: '#332E1A',
	},
};

const lightTheme = {
	background: {
		primary: '#FFFFFF',
		secondary: '#F2F2F7',
		tertiary: '#E5E5EA',
		quaternary: '#F5F5F5',
		overlay: 'rgba(0, 0, 0, 0.75)',
		statusBar: 'transparent',
		whiteText: '#1A1B1C'
	},
	text: {
		primary: '#000000',
		secondary: '#666666',
		subtleText: '#E5E5EA',
		lightWarning: '#2e2b2a',
		white: '#FFFFFF',
	},
	primary: '#007AFF',
	secondary: '#4CD964',
	danger: '#FF3B30',
	warning: '#FF9500',
	lightWarning: '#fa6b7e',
	lightHighlight: '#87EF66',
	success: '#34C759',
	border: '#E5E5EA',
	tabBar: {
		background: '#E0E0E0',
	},
	reminderTypes: {
		follow_up: '#E6F3FF',
		scheduled: '#E6FFE6',
		custom_date: '#F5E6FF',
	},
	tags: tagColors.light,
};

const darkTheme = {
	background: {
		primary: '#000000',
		secondary: '#1C1C1E',
		tertiary: '#2C2C2E',
		quaternary: '#3A3A3C',
		overlay: 'rgba(0, 0, 0, 0.9)',
		statusBar: 'transparent',
		whiteText: '#000000'
	},
	text: {
		primary: '#FFFFFF',
		secondary: '#8E8E93',
		subtleText: '#1C1C1E',
		lightWarning: '#bab8b8',
		white: '#FFFFFF',
	},
	primary: '#0A84FF',
	secondary: '#30D158',
	danger: '#FF453A',
	warning: '#FFD60A',
	lightWarning: '#75150D',
	lightHighlight: '#0A5A18',
	success: '#32D74B',
	border: '#3A3A3C',
	tabBar: {
		background: '#2C2C2E',
	},
	reminderTypes: {
		follow_up: '#1C2733',
		scheduled: '#1C291C',
		custom_date: '#291C33',
	},
	tags: tagColors.dark,
};

const dimmedTheme = {
	background: {
		primary: '#1A1A1A',
		secondary: '#2D2D2D',
		tertiary: '#404040',
		quaternary: '#4D4D4D',
		overlay: 'rgba(0, 0, 0, 0.85)',
		statusBar: 'transparent',
		whiteText: '#000000',
	},
	text: {
		primary: '#E0E0E0',
		secondary: '#A0A0A0',
		subtleText: '#2D2D2D',
		lightWarning: '#D0D0D0',
		white: '#FFFFFF',
	},
	primary: '#3B82F6',
	secondary: '#34D399',
	danger: '#EF4444',
	warning: '#F59E0B',
	lightWarning: '#92400E',
	lightHighlight: '#065F46',
	success: '#10B981',
	border: '#404040',
	tabBar: {
		background: '#333333',
	},
	reminderTypes: {
		follow_up: '#1E3A8A',
		scheduled: '#064E3B',
		custom_date: '#3D1B40',
	},
	tags: tagColors.dark,
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
