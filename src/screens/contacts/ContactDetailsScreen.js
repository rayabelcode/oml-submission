import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert, Appearance } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { useContactDetailsStyles } from '../../styles/contacts/contactDetails';
import CallNotesTab from '../../components/contacts/tabs/CallNotesTab';
import EditContactTab from '../../components/contacts/tabs/EditContactTab';
import ScheduleTab from '../../components/contacts/tabs/ScheduleTab';
import CallOptions from '../../components/general/CallOptions';
import { subscribeToContactDetails, updateContact } from '../../utils/firestore';
import { useFocusEffect } from '@react-navigation/native';

const ContactDetailsScreen = ({ route, navigation }) => {
	const { contact: initialContact, initialTab = 'Notes' } = route.params;
	const { colors, theme } = useTheme();
	const currentTheme = theme === 'system' ? Appearance.getColorScheme() : theme === 'dimmed' ? 'dark' : theme;
	const styles = useContactDetailsStyles();
	const [contact, setContact] = useState({ ...initialContact });
	const [history, setHistory] = useState([]);
	const [showCallOptions, setShowCallOptions] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(
		initialTab === 'Notes' ? 0 : initialTab === 'Schedule' ? 1 : 2
	);
	const [unsubscribeRef, setUnsubscribeRef] = useState(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		if (contact?.contact_history) {
			// Clone and sort the history
			const sortedHistory = Array.isArray(contact.contact_history)
				? [...contact.contact_history].sort((a, b) => new Date(b.date) - new Date(a.date))
				: [];
			setHistory(sortedHistory);
		}
	}, [contact]);

	// Set up real-time subscription
	const loadContactData = useCallback(async () => {
		try {
			if (unsubscribeRef) {
				unsubscribeRef();
			}

			// Set initial history from contact
			if (contact?.contact_history) {
				const sortedHistory = Array.isArray(contact.contact_history)
					? [...contact.contact_history].sort((a, b) => new Date(b.date) - new Date(a.date))
					: [];
				setHistory(sortedHistory);
			}

			// Set loading to false after initial history is set
			setIsLoading(false);

			const unsubscribe = subscribeToContactDetails(
				contact.id,
				(updatedContact) => {
					if (updatedContact) {
						// Shallow clone for immutability
						const clonedContact = { ...updatedContact };
						setContact(clonedContact);

						const sortedHistory = Array.isArray(clonedContact.contact_history)
							? [...clonedContact.contact_history].sort((a, b) => new Date(b.date) - new Date(a.date))
							: [];
						setHistory(sortedHistory);
						setError(null);
					}
				},
				(error) => {
					console.error('Contact subscription error:', error);
					setError('Failed to load contact updates');
				}
			);

			setUnsubscribeRef(unsubscribe);
		} catch (error) {
			console.error('Error in loadContactData:', error);
			setError('Failed to set up contact updates');
			setIsLoading(false);
		}
	}, [contact?.id]);

	useFocusEffect(
		useCallback(() => {
			loadContactData();
			return () => {
				if (unsubscribeRef) {
					unsubscribeRef();
				}
			};
		}, [loadContactData])
	);

	useEffect(() => {
		return () => {
			if (unsubscribeRef) {
				unsubscribeRef();
			}
		};
	}, []);

	const handleUpdateContact = async (updatedData) => {
		try {
			// Clone contact and apply updates immutably
			const updatedContact = { ...contact, ...updatedData };

			// Update state
			setContact(updatedContact);

			// Update Firestore
			await updateContact(contact.id, updatedData);
			setError(null);
		} catch (error) {
			console.error('Error updating contact:', error);
			setError('Failed to update contact');
			Alert.alert('Error', 'Failed to update contact. Please try again.');
		}
	};

	const renderContent = () => {
		if (error) {
			return (
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>{error}</Text>
					<TouchableOpacity style={styles.retryButton} onPress={loadContactData}>
						<Text style={styles.retryButtonText}>Retry</Text>
					</TouchableOpacity>
				</View>
			);
		}

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
					<Icon name="chatbox-ellipses-outline" size={22} color={theme === 'light' ? '#FFFFFF' : '#000000'} />
				</TouchableOpacity>
				{showCallOptions && (
					<CallOptions show={showCallOptions} contact={contact} onClose={() => setShowCallOptions(false)} />
				)}
			</View>

			<View style={styles.contentContainer}>
				{isLoading ? (
					<View style={styles.errorContainer}>
						<Text>Loading...</Text>
					</View>
				) : (
					renderContent()
				)}
			</View>

			{/* Segmented Control for: Notes, Schedule, and Profile Tabs */}
			<View style={styles.segmentedControlContainer}>
				<View style={styles.segmentedWrapper}>
					<TouchableOpacity
						style={[
							styles.segment,
							selectedIndex === 0 && styles.selectedSegment,
							{ borderRightWidth: 1, borderRightColor: colors.border },
						]}
						onPress={() => setSelectedIndex(0)}
					>
						<Icon
							name="document-text-outline"
							size={30}
							color={selectedIndex === 0 ? colors.primary : colors.text.secondary}
						/>
					</TouchableOpacity>
					<TouchableOpacity
						style={[
							styles.segment,
							selectedIndex === 1 && styles.selectedSegment,
							{ borderRightWidth: 1, borderRightColor: colors.border },
						]}
						onPress={() => setSelectedIndex(1)}
					>
						<Icon
							name="calendar-outline"
							size={30}
							color={selectedIndex === 1 ? colors.primary : colors.text.secondary}
						/>
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.segment, selectedIndex === 2 && styles.selectedSegment]}
						onPress={() => setSelectedIndex(2)}
					>
						<Icon
							name="person-outline"
							size={30}
							color={selectedIndex === 2 ? colors.primary : colors.text.secondary}
						/>
					</TouchableOpacity>
				</View>
			</View>
		</View>
	);
};

export default ContactDetailsScreen;
