import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import { spacing, useTheme } from '../context/ThemeContext';
import { Platform, StatusBar } from 'react-native';
import { useAuth } from '../context/AuthContext';
import React, { useEffect } from 'react';

import DashboardScreen from '../screens/DashboardScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import SettingsStack from './SettingsStack';
import ContactsStack from './ContactsStack';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
	const { colors, theme } = useTheme();
	const { user } = useAuth();

	useEffect(() => {
		const updateStatusBar = async () => {
			await StatusBar.setBarStyle(
				theme === 'dark' || theme === 'dimmed' ? 'light-content' : 'dark-content',
				true
			);
		};
		updateStatusBar();
	}, [theme, user]);

	if (!user) {
		return <SettingsStack />;
	}

	return (
		<Tab.Navigator
			screenOptions={({ route }) => ({
				tabBarIcon: ({ focused, color, size }) => {
					const iconNames = {
						Home: focused ? 'people' : 'people-outline',
						Schedule: focused ? 'calendar-clear' : 'calendar-clear-outline',
						Dashboard: focused ? 'grid' : 'grid-outline',
						Settings: focused ? 'settings' : 'settings-outline',
					}[route.name];

					// Increase Home icon size
					const adjustedSize = route.name === 'Home' ? size * 1.2 : size * 1;
					return <Icon name={iconNames} size={adjustedSize} color={color} />;
				},
				tabBarStyle: {
					backgroundColor: colors.background.primary,
					borderTopColor: colors.border,
					borderTopWidth: 0.5,
					paddingTop: 2,
					paddingBottom: Platform.OS === 'ios' ? 8 : 4,
					height: Platform.OS === 'ios' ? 80 : 60,
				},
				tabBarActiveTintColor: colors.primary,
				tabBarInactiveTintColor: colors.text.secondary,
				headerShown: false,
				tabBarLabelStyle: {
					marginTop: spacing.xs,
					color: colors.text.primary,
					opacity: 0.9,
					fontWeight: '600',
					fontSize: Platform.OS === 'ios' ? 12 : 11, // Font size on iOS : Android
				},
			})}
		>
			<Tab.Screen name="Home" component={ContactsStack} />
			<Tab.Screen name="Schedule" component={ScheduleScreen} />
			<Tab.Screen name="Dashboard" component={DashboardScreen} />
			<Tab.Screen name="Settings" component={SettingsStack} />
		</Tab.Navigator>
	);
}
