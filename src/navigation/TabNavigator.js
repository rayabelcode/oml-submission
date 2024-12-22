import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

import DashboardScreen from '../screens/DashboardScreen';
import ContactsScreen from '../screens/ContactsScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
	const { colors, theme } = useTheme();

	return (
		<Tab.Navigator
			screenOptions={({ route }) => ({
				tabBarIcon: ({ color, size }) => {
					const iconName = {
						Contacts: 'people-outline',
						Calendar: 'calendar-outline',
						Settings: 'settings-outline',
					}[route.name];
					return <Icon name={iconName} size={size} color={color} />;
				},
				tabBarActiveTintColor: colors.primary,
				tabBarInactiveTintColor: colors.text.secondary,
				tabBarStyle: {
					backgroundColor: colors.background.primary,
					borderTopColor: colors.border,
				},
				headerShown: false, // Remove header from all screens
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
