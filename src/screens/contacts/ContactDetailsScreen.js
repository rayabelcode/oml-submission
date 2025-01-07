// src/screens/contacts/ContactDetailsScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { useStyles } from '../../styles/screens/contacts';
import CallNotesTab from '../../components/contacts/tabs/CallNotesTab';
import EditContactTab from '../../components/contacts/tabs/EditContactTab';
import ScheduleTab from '../../components/contacts/tabs/ScheduleTab';
import CallOptions from '../../components/general/CallOptions';
import { fetchContactHistory } from '../../utils/firestore';

const ContactDetailsScreen = ({ route, navigation }) => {
	const { contact, loadContacts, setSelectedContact } = route.params;
	const { colors } = useTheme();
	const styles = useStyles();

	const [activeTab, setActiveTab] = useState('notes'); // Default to Notes
	const [history, setHistory] = useState([]);
	const [showCallOptions, setShowCallOptions] = useState(false);

	useEffect(() => {
		if (contact?.id) {
			// Fetch history for the contact
			fetchContactHistory(contact.id)
				.then((fetchedHistory) => {
					const sortedHistory = (fetchedHistory || []).sort((a, b) => new Date(b.date) - new Date(a.date));
					setHistory(sortedHistory);
				})
				.catch(() => {
					// If fetching fails, ensure history is set to an empty array
					setHistory([]);
				});
		}
	}, [contact]);

	const renderTabContent = () => {
		switch (activeTab) {
			case 'notes':
				return (
					<CallNotesTab
						contact={contact}
						history={history}
						setHistory={setHistory}
						setSelectedContact={setSelectedContact}
					/>
				);
			case 'schedule':
				return (
					<ScheduleTab
						contact={contact}
						setSelectedContact={setSelectedContact}
						loadContacts={loadContacts}
					/>
				);
			case 'edit':
				return (
					<EditContactTab
						contact={contact}
						setSelectedContact={setSelectedContact}
						loadContacts={loadContacts}
					/>
				);
			default:
				return null;
		}
	};

	return (
		<View style={styles.container}>
			{/* Header */}
			<View style={styles.header}>
				<TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
					<Icon name="arrow-back" size={24} color={colors.text.primary} />
				</TouchableOpacity>
				<Text style={[styles.modalTitle, { flex: 1 }]}>
					{contact.first_name} {contact.last_name}
				</Text>
				<TouchableOpacity onPress={() => setShowCallOptions(!showCallOptions)} style={styles.headerButton}>
					<Icon name="call" size={24} color={colors.primary} />
				</TouchableOpacity>
				{showCallOptions && (
					<CallOptions show={showCallOptions} contact={contact} onClose={() => setShowCallOptions(false)} />
				)}
			</View>

			{/* Tabs */}
			<View style={styles.tabBar}>
				<TouchableOpacity
					style={[styles.tabItem, activeTab === 'notes' && styles.activeTab]}
					onPress={() => setActiveTab('notes')}
				>
					<Icon
						name="document-text-outline"
						size={20}
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
						size={20}
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
						size={20}
						color={activeTab === 'edit' ? colors.primary : colors.text.secondary}
					/>
					<Text style={[styles.tabLabel, activeTab === 'edit' && styles.activeTabLabel]}>Profile</Text>
				</TouchableOpacity>
			</View>

			{/* Tab Content */}
			<ScrollView style={styles.tabContent}>{renderTabContent()}</ScrollView>
		</View>
	);
};

export default ContactDetailsScreen;
