import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ContactsScreen from '../screens/ContactsScreen';
import ContactDetailsScreen from '../screens/contacts/ContactDetailsScreen';

const Stack = createNativeStackNavigator();

export default function ContactsStack() {
	return (
		<Stack.Navigator screenOptions={{ headerShown: false }}>
			<Stack.Screen name="ContactsMain" component={ContactsScreen} />
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
