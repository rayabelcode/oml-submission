import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigator from './TabNavigator';
import ContactDetailsScreen from '../screens/contacts/ContactDetailsScreen';
import { useTheme } from '../context/ThemeContext';

const Stack = createNativeStackNavigator();

export default function SharedNavigator() {
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
			<Stack.Screen name="MainTabs" component={TabNavigator} />
			<Stack.Screen
				name="ContactDetails"
				component={ContactDetailsScreen}
				options={{
					presentation: 'modal',
					animation: 'slide_from_bottom',
					contentStyle: {
						backgroundColor: colors.background.primary,
					},
				}}
			/>
		</Stack.Navigator>
	);
}
