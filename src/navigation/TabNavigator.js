import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import { spacing, useTheme } from '../context/ThemeContext';
import { Platform, StatusBar } from 'react-native';
import { useAuth } from '../context/AuthContext';
import React, { useEffect } from 'react';

import DashboardScreen from '../screens/DashboardScreen';
import StatsScreen from '../screens/StatsScreen';
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
						Contacts: focused ? 'people' : 'people-outline',
						Dashboard: focused ? 'grid' : 'grid-outline',
						Stats: focused ? 'stats-chart' : 'stats-chart-outline',
						Settings: focused ? 'settings' : 'settings-outline',
					}[route.name];
					return <Icon name={iconNames} size={size * 1.05} color={color} />; // Scale up icon size
				},
				tabBarStyle: {
					backgroundColor: colors.background.primary,
					borderTopColor: colors.border,
					borderTopWidth: 1,
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
					fontSize: Platform.OS === 'ios' ? 11 : 11, // Font size on iOS : Android
				},
			})}
		>
			<Tab.Screen name="Contacts" component={ContactsStack} />
			<Tab.Screen name="Dashboard" component={DashboardScreen} />
			<Tab.Screen name="Stats" component={StatsScreen} />
			<Tab.Screen name="Settings" component={SettingsStack} />
		</Tab.Navigator>
	);
}
