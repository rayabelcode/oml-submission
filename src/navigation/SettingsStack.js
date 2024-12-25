import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import SettingsScreen from '../screens/SettingsScreen';
import ProfileScreen from '../screens/settings/ProfileScreen';
import AccountScreen from '../screens/settings/AccountScreen';
import PrivacyScreen from '../screens/settings/PrivacyScreen';

const Stack = createStackNavigator();

const SettingsStack = () => {
	return (
		<Stack.Navigator
			screenOptions={{
				headerShown: false,
			}}
		>
			<Stack.Screen name="SettingsMain" component={SettingsScreen} />
			<Stack.Screen name="Profile" component={ProfileScreen} />
			<Stack.Screen name="Account" component={AccountScreen} />
			<Stack.Screen name="Privacy" component={PrivacyScreen} />
		</Stack.Navigator>
	);
};

export default SettingsStack;
