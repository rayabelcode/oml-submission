import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Users, Settings } from 'lucide-react-native';

import DashboardScreen from '../screens/DashboardScreen.js';
import ContactsScreen from '../screens/ContactsScreen.js';
import SettingsScreen from '../screens/SettingsScreen.js';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === 'Dashboard') {
            return <Home size={size} color={color} />;
          } else if (route.name === 'Contacts') {
            return <Users size={size} color={color} />;
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
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Contacts" component={ContactsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
