import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigator from './TabNavigator';
import ContactDetailsScreen from '../screens/contacts/ContactDetailsScreen';

const Stack = createNativeStackNavigator();

export default function SharedNavigator() {
	return (
		<Stack.Navigator screenOptions={{ headerShown: false }}>
			<Stack.Screen name="MainTabs" component={TabNavigator} />
			<Stack.Screen
				name="ContactDetails"
				component={ContactDetailsScreen}
				options={{
					presentation: 'modal',
					animation: 'slide_from_bottom',
				}}
			/>
		</Stack.Navigator>
	);
}
