import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SettingsScreen from '../screens/SettingsScreen';
import ProfileScreen from '../screens/settings/ProfileScreen';
import AccountScreen from '../screens/settings/AccountScreen';
import PrivacyScreen from '../screens/settings/PrivacyScreen';
import AboutScreen from '../screens/settings/AboutScreen';
import SchedulingScreen from '../screens/settings/SchedulingScreen';
import NotificationSettingsScreen from '../screens/settings/NotificationSettingsScreen';
import RelationshipTypeSettings from '../screens/settings/RelationshipTypeSettings';
import StatsScreen from '../screens/StatsScreen';
import { useTheme } from '../context/ThemeContext';

const Stack = createNativeStackNavigator();

const SettingsStack = () => {
	const { colors } = useTheme();

	return (
		<Stack.Navigator
			screenOptions={{
				headerShown: false,
				contentStyle: {
					backgroundColor: colors.background.primary,
				},
			}}
		>
			<Stack.Screen name="SettingsMain" component={SettingsScreen} />
			<Stack.Screen name="Profile" component={ProfileScreen} />
			<Stack.Screen name="Account" component={AccountScreen} />
			<Stack.Screen name="Privacy" component={PrivacyScreen} />
			<Stack.Screen name="About" component={AboutScreen} />
			<Stack.Screen name="Scheduling" component={SchedulingScreen} />
			<Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
			<Stack.Screen name="RelationshipTypeSettings" component={RelationshipTypeSettings} />
			<Stack.Screen name="Stats" component={StatsScreen} />
		</Stack.Navigator>
	);
};

export default SettingsStack;
