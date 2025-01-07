import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { useContactDetailsStyles } from '../../styles/contacts/contactDetails';
import CallNotesTab from '../../components/contacts/tabs/CallNotesTab';
import EditContactTab from '../../components/contacts/tabs/EditContactTab';
import ScheduleTab from '../../components/contacts/tabs/ScheduleTab';
import CallOptions from '../../components/general/CallOptions';
import { fetchContactHistory, fetchContacts } from '../../utils/firestore';
import { useFocusEffect } from '@react-navigation/native';

const ContactDetailsScreen = ({ route, navigation }) => {
	const { contact: initialContact, initialTab = 'Notes' } = route.params;
	const { colors, theme } = useTheme();
	const styles = useContactDetailsStyles();
	const [contact, setContact] = useState(initialContact);
	const [history, setHistory] = useState([]);
	const [showCallOptions, setShowCallOptions] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(
		initialTab === 'Notes' ? 0 : initialTab === 'Schedule' ? 1 : 2
	);

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

	const renderContent = () => {
		switch (selectedIndex) {
			case 0:
				return (
					<CallNotesTab
						contact={contact}
						history={history}
						setHistory={setHistory}
						setSelectedContact={handleUpdateContact}
					/>
				);
			case 1:
				return (
					<ScheduleTab
						contact={contact}
						setSelectedContact={handleUpdateContact}
						loadContacts={loadContactData}
					/>
				);
			case 2:
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

	const localStyles = StyleSheet.create({
		container: {
			flex: 1,
		},
		contentContainer: {
			flex: 1,
			marginBottom: 65,
		},
		segmentedControlContainer: {
			position: 'absolute',
			bottom: 0,
			left: 0,
			right: 0,
			paddingHorizontal: 10,
			paddingBottom: Platform.OS === 'ios' ? 34 : 24,
			backgroundColor: 'transparent',
		},
		segmentedWrapper: {
			flexDirection: 'row',
			backgroundColor: theme === 'dark' ? '#1C1C1E' : '#F2F2F7',
			borderRadius: 12,
			borderWidth: 1,
			borderColor: colors.border,
			height: 50,
			overflow: 'hidden',
		},
		segment: {
			flex: 1,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			paddingVertical: 8,
			gap: 6,
		},
		selectedSegment: {
			backgroundColor: theme === 'dark' ? '#2C2C2E' : '#FFFFFF',
		},
		segmentText: {
			fontSize: 13,
			color: colors.text.secondary,
			fontWeight: '500',
		},
		selectedText: {
			color: colors.primary,
			fontWeight: '600',
		},
	});

	return (
		<View style={[styles.container, localStyles.container]}>
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

			<View style={localStyles.contentContainer}>{renderContent()}</View>

			<View style={localStyles.segmentedControlContainer}>
				<View style={localStyles.segmentedWrapper}>
					<TouchableOpacity
						style={[
							localStyles.segment,
							selectedIndex === 0 && localStyles.selectedSegment,
							{ borderRightWidth: 1, borderRightColor: colors.border },
						]}
						onPress={() => setSelectedIndex(0)}
					>
						<Icon
							name="document-text-outline"
							size={20}
							color={selectedIndex === 0 ? colors.primary : colors.text.secondary}
						/>
						<Text style={[localStyles.segmentText, selectedIndex === 0 && localStyles.selectedText]}>
							Notes
						</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={[
							localStyles.segment,
							selectedIndex === 1 && localStyles.selectedSegment,
							{ borderRightWidth: 1, borderRightColor: colors.border },
						]}
						onPress={() => setSelectedIndex(1)}
					>
						<Icon
							name="calendar-outline"
							size={20}
							color={selectedIndex === 1 ? colors.primary : colors.text.secondary}
						/>
						<Text style={[localStyles.segmentText, selectedIndex === 1 && localStyles.selectedText]}>
							Schedule
						</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={[localStyles.segment, selectedIndex === 2 && localStyles.selectedSegment]}
						onPress={() => setSelectedIndex(2)}
					>
						<Icon
							name="person-outline"
							size={20}
							color={selectedIndex === 2 ? colors.primary : colors.text.secondary}
						/>
						<Text style={[localStyles.segmentText, selectedIndex === 2 && localStyles.selectedText]}>
							Profile
						</Text>
					</TouchableOpacity>
				</View>
			</View>
		</View>
	);
};

export default ContactDetailsScreen;
