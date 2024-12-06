import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Users, Calendar, Settings } from 'lucide-react-native';

import DashboardScreen from '../screens/DashboardScreen';
import ContactsScreen from '../screens/ContactsScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
	return (
		<Tab.Navigator
			screenOptions={({ route }) => ({
				tabBarIcon: ({ focused, color, size }) => {
					if (route.name === 'Contacts') {
						return <Users size={size} color={color} />;
					} else if (route.name === 'Calendar') {
						return <Calendar size={size} color={color} />;
					} else if (route.name === 'Settings') {
						return <Settings size={size} color={color} />;
					}
				},
				tabBarActiveTintColor: '#007AFF',
				tabBarInactiveTintColor: 'gray',
				headerShown: true,
				headerTitleAlign: 'center',
			})}
		>
			<Tab.Screen name="Contacts" component={ContactsScreen} />
			<Tab.Screen name="Calendar" component={DashboardScreen} />
			<Tab.Screen name="Settings" component={SettingsScreen} />
		</Tab.Navigator>
	);
}
