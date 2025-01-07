import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { useStyles } from '../../styles/screens/contacts';
import CallNotesTab from '../../components/contacts/tabs/CallNotesTab';
import EditContactTab from '../../components/contacts/tabs/EditContactTab';
import ScheduleTab from '../../components/contacts/tabs/ScheduleTab';
import CallOptions from '../../components/general/CallOptions';
import { fetchContactHistory, fetchContacts } from '../../utils/firestore';
import { useFocusEffect } from '@react-navigation/native';

const ContactDetailsScreen = ({ route, navigation }) => {
	const { contact: initialContact } = route.params;
	const { colors } = useTheme();
	const styles = useStyles();

	const [contact, setContact] = useState(initialContact);
	const [activeTab, setActiveTab] = useState('notes');
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
			return () => {};
		}, [loadContactData])
	);

	const handleUpdateContact = async (updatedContact) => {
		setContact(updatedContact);
		await loadContactData();
	};

	const renderTabContent = () => {
		switch (activeTab) {
			case 'notes':
				return (
					<CallNotesTab
						contact={contact}
						history={history}
						setHistory={setHistory}
						setSelectedContact={handleUpdateContact}
					/>
				);
			case 'schedule':
				return (
					<ScheduleTab
						contact={contact}
						setSelectedContact={handleUpdateContact}
						loadContacts={loadContactData}
					/>
				);
			case 'edit':
				return (
					<EditContactTab
						contact={contact}
						setSelectedContact={handleUpdateContact}
						loadContacts={loadContactData}
						onClose={() => navigation.goBack()}
					/>
				);
			default:
				return null;
		}
	};

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
					<Icon name="arrow-back" size={24} color={colors.text.primary} />
				</TouchableOpacity>
				<Text style={[styles.modalTitle, { flex: 1, textAlign: 'center' }]} numberOfLines={1}>
					{contact.first_name} {contact.last_name}
				</Text>
				<TouchableOpacity onPress={() => setShowCallOptions(!showCallOptions)} style={styles.headerButton}>
					<Icon name="call" size={24} color={colors.primary} />
				</TouchableOpacity>
				{showCallOptions && (
					<CallOptions show={showCallOptions} contact={contact} onClose={() => setShowCallOptions(false)} />
				)}
			</View>

			<View style={styles.tabBar}>
				<TouchableOpacity
					style={[styles.tabItem, activeTab === 'notes' && styles.activeTab]}
					onPress={() => setActiveTab('notes')}
				>
					<Icon
						name="document-text-outline"
						size={24}
						color={activeTab === 'notes' ? colors.primary : colors.text.secondary}
					/>
					<Text style={[styles.tabLabel, activeTab === 'notes' && styles.activeTabLabel]}>Notes</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={[styles.tabItem, activeTab === 'schedule' && styles.activeTab]}
					onPress={() => setActiveTab('schedule')}
				>
					<Icon
						name="calendar-outline"
						size={24}
						color={activeTab === 'schedule' ? colors.primary : colors.text.secondary}
					/>
					<Text style={[styles.tabLabel, activeTab === 'schedule' && styles.activeTabLabel]}>Schedule</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={[styles.tabItem, activeTab === 'edit' && styles.activeTab]}
					onPress={() => setActiveTab('edit')}
				>
					<Icon
						name="create-outline"
						size={24}
						color={activeTab === 'edit' ? colors.primary : colors.text.secondary}
					/>
					<Text style={[styles.tabLabel, activeTab === 'edit' && styles.activeTabLabel]}>Profile</Text>
				</TouchableOpacity>
			</View>

			<ScrollView style={styles.tabContent}>{renderTabContent()}</ScrollView>
		</View>
	);
};

export default ContactDetailsScreen;
