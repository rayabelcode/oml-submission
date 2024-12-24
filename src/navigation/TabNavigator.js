import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { Platform } from 'react-native';
import { useAuth } from '../context/AuthContext'; // Add this import

import DashboardScreen from '../screens/DashboardScreen';
import ContactsScreen from '../screens/ContactsScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
	const { colors, theme } = useTheme();
	const { user } = useAuth(); // Add this line

	if (!user) {
		return (
			<Tab.Navigator
				screenOptions={{
					headerShown: false,
					tabBarStyle: { display: 'none' },
				}}
			>
				<Tab.Screen name="Settings" component={SettingsScreen} />
			</Tab.Navigator>
		);
	}

	return (
		<Tab.Navigator
			screenOptions={({ route }) => ({
				tabBarIcon: ({ focused, color, size }) => {
					const iconNames = {
						Contacts: focused ? 'people' : 'people-outline',
						Calendar: focused ? 'calendar' : 'calendar-outline',
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
			<Tab.Screen name="Calendar" component={DashboardScreen} />
			<Tab.Screen name="Settings" component={SettingsScreen} />
		</Tab.Navigator>
	);
}
