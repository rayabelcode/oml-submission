import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ContactsScreen from '../screens/ContactsScreen';

const Stack = createNativeStackNavigator();

export default function ContactsStack() {
	return (
		<Stack.Navigator screenOptions={{ headerShown: false }}>
			<Stack.Screen name="ContactsMain" component={ContactsScreen} />
		</Stack.Navigator>
	);
}
