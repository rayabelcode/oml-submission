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
		subtleText: '#E5E5EA',
		lightWarning: '#2e2b2a',
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
};

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
		subtleText: '#1C1C1E',
		lightWarning: '#bab8b8',
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
};

const dimmedTheme = {
	background: {
		primary: '#1A1A1A',
		secondary: '#2D2D2D',
		tertiary: '#404040',
		quaternary: '#4D4D4D',
		overlay: 'rgba(0, 0, 0, 0.85)',
		statusBar: 'transparent',
	},
	text: {
		primary: '#E0E0E0',
		secondary: '#A0A0A0',
		subtleText: '#2D2D2D',
		lightWarning: '#D0D0D0',
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
};

export function ThemeProvider({ children }) {
	const systemTheme = useColorScheme();
	const [userTheme, setUserTheme] = useState('system');

	useEffect(() => {
		AsyncStorage.getItem('theme').then((savedTheme) => {
			if (savedTheme) setUserTheme(savedTheme);
		});
	}, []);

	// Recalculate colors when systemTheme changes
	const colors = React.useMemo(
		() =>
			userTheme === 'system'
				? systemTheme === 'dark'
					? darkTheme
					: lightTheme
				: userTheme === 'light'
				? lightTheme
				: userTheme === 'dimmed'
				? dimmedTheme
				: darkTheme,
		[userTheme, systemTheme]
	);

	const setThemeValue = async (newTheme) => {
		setUserTheme(newTheme);
		await AsyncStorage.setItem('theme', newTheme);
	};

	return (
		<ThemeContext.Provider
			value={{
				theme: userTheme,
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
