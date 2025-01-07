import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { useContactDetailsStyles } from '../../styles/contacts/contactDetails';
import CallNotesTab from '../../components/contacts/tabs/CallNotesTab';
import EditContactTab from '../../components/contacts/tabs/EditContactTab';
import ScheduleTab from '../../components/contacts/tabs/ScheduleTab';
import CallOptions from '../../components/general/CallOptions';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { fetchContactHistory, fetchContacts } from '../../utils/firestore';
import { useFocusEffect } from '@react-navigation/native';

const Tab = createBottomTabNavigator();

const ContactDetailsScreen = ({ route, navigation }) => {
	const { contact: initialContact, initialTab = 'Notes' } = route.params;
	const { colors, theme } = useTheme();
	const styles = useContactDetailsStyles();
	const [contact, setContact] = useState(initialContact);
	const [history, setHistory] = useState([]);
	const [showCallOptions, setShowCallOptions] = useState(false);

	const loadContactData = useCallback(async () => {
		try {
			const contactsList = await fetchContacts(contact.user_id);
			const updatedContact = [...contactsList.scheduledContacts, ...contactsList.unscheduledContacts].find(
				(c) => c.id === contact.id
			);

			if (updatedContact) {
				setContact(updatedContact);
				const fetchedHistory = await fetchContactHistory(updatedContact.id);
				setHistory(fetchedHistory.sort((a, b) => new Date(b.date) - new Date(a.date)));
			}
		} catch (error) {
			console.error('Error loading contact data:', error);
		}
	}, [contact?.id, contact?.user_id]);

	useFocusEffect(
		useCallback(() => {
			loadContactData();
		}, [loadContactData])
	);

	const handleUpdateContact = async (updatedContact) => {
		setContact(updatedContact);
		await loadContactData();
	};

	return (
		<View style={styles.container}>
			<View style={styles.headerContainer}>
				<TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
					<Icon name="chevron-back-outline" size={28} color={colors.text.primary} />
				</TouchableOpacity>

				<Text style={styles.headerTitle} numberOfLines={1}>
					{`${contact.first_name} ${contact.last_name}`}
				</Text>

				<TouchableOpacity style={styles.phoneButton} onPress={() => setShowCallOptions(!showCallOptions)}>
					<Icon name="call" size={22} color={theme === 'light' ? '#FFFFFF' : '#000000'} />
				</TouchableOpacity>
				{showCallOptions && (
					<CallOptions show={showCallOptions} contact={contact} onClose={() => setShowCallOptions(false)} />
				)}
			</View>

			<Tab.Navigator
				initialRouteName={initialTab}
				screenOptions={{
					tabBarStyle: {
						backgroundColor: colors.tabBar.background,
						borderTopColor: colors.border,
						borderTopWidth: 1,
						elevation: 8,
						shadowColor: '#000',
						shadowOffset: {
							width: 0,
							height: -4,
						},
						shadowOpacity: 0.1,
						shadowRadius: 4,
						height: Platform.OS === 'ios' ? 88 : 60,
						paddingBottom: Platform.OS === 'ios' ? 30 : 8,
					},
					tabBarActiveTintColor: colors.primary,
					tabBarInactiveTintColor: colors.text.secondary,
					tabBarLabelStyle: {
						fontSize: 12,
						fontWeight: '500',
					},
					sceneContainerStyle: {
						backgroundColor: colors.background.primary,
					},
				}}
			>
				<Tab.Screen
					name="Notes"
					options={{
						headerShown: false,
						tabBarIcon: ({ color, size }) => <Icon name="document-text-outline" size={size} color={color} />,
					}}
				>
					{(props) => (
						<View style={{ flex: 1, backgroundColor: colors.background.primary }}>
							<CallNotesTab
								{...props}
								contact={contact}
								history={history}
								setHistory={setHistory}
								setSelectedContact={handleUpdateContact}
							/>
						</View>
					)}
				</Tab.Screen>
				<Tab.Screen
					name="Schedule"
					options={{
						headerShown: false,
						tabBarIcon: ({ color, size }) => <Icon name="calendar-outline" size={size} color={color} />,
					}}
				>
					{(props) => (
						<View style={{ flex: 1, backgroundColor: colors.background.primary }}>
							<ScheduleTab
								{...props}
								contact={contact}
								setSelectedContact={handleUpdateContact}
								loadContacts={loadContactData}
							/>
						</View>
					)}
				</Tab.Screen>
				<Tab.Screen
					name="Profile"
					options={{
						headerShown: false,
						tabBarIcon: ({ color, size }) => <Icon name="person-outline" size={size} color={color} />,
					}}
				>
					{(props) => (
						<View style={{ flex: 1, backgroundColor: colors.background.primary }}>
							<EditContactTab
								{...props}
								contact={contact}
								setSelectedContact={handleUpdateContact}
								loadContacts={loadContactData}
								onClose={() => navigation.goBack()}
							/>
						</View>
					)}
				</Tab.Screen>
			</Tab.Navigator>
		</View>
	);
};

export default ContactDetailsScreen;
