import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { Platform, StatusBar } from 'react-native';
import { useAuth } from '../context/AuthContext';
import React, { useEffect } from 'react';

import DashboardScreen from '../screens/DashboardScreen';
import ContactsScreen from '../screens/ContactsScreen';
import StatsScreen from '../screens/StatsScreen';
import SettingsStack from './SettingsStack';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
	const { colors, theme } = useTheme();
	const { user } = useAuth();

	useEffect(() => {
		const updateStatusBar = async () => {
			await StatusBar.setBarStyle(theme === 'dark' ? 'light-content' : 'dark-content', true);
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
						Dashboard: focused ? 'calendar' : 'calendar-outline',
						Stats: focused ? 'stats-chart' : 'stats-chart-outline',
						Settings: focused ? 'settings' : 'settings-outline',
					}[route.name];
					return <Icon name={iconNames} size={size} color={color} />;
				},
				tabBarActiveTintColor: colors.primary,
				tabBarInactiveTintColor: colors.text.secondary,
				tabBarStyle: {
					backgroundColor: colors.background.primary,
					borderTopColor: colors.border,
					paddingBottom: Platform.OS === 'ios' ? 20 : 8,
					height: Platform.OS === 'ios' ? 85 : 60,
				},
				headerShown: false,
				tabBarLabelStyle: {
					color: colors.text.primary,
				},
			})}
		>
			<Tab.Screen name="Contacts" component={ContactsScreen} />
			<Tab.Screen name="Dashboard" component={DashboardScreen} />
			<Tab.Screen name="Stats" component={StatsScreen} />
			<Tab.Screen name="Settings" component={SettingsStack} />
		</Tab.Navigator>
	);
}
