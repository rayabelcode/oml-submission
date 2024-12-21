import React, { useState, useEffect, useRef } from 'react';
import { Modal, Image, Dimensions } from 'react-native';
import DatePicker from 'react-datepicker';
import { SafeAreaView } from 'react-native';
import { Text, View, ScrollView, TouchableOpacity, TextInput, RefreshControl, Alert } from 'react-native';
import styles from '../styles/screens/contacts';
import commonStyles from '../styles/common';
import { colors } from '../styles/theme';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import {
	fetchContacts,
	archiveContact,
	deleteContact,
	addContact,
	updateContact,
	addContactHistory,
	fetchContactHistory,
	uploadContactPhoto,
} from '../utils/firestore';
import Logo from '../../assets/full-logo-color.png';
import { Platform } from 'react-native';
import * as Contacts from 'expo-contacts';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image as ExpoImage } from 'expo-image';
import { serverTimestamp } from 'firebase/firestore';
// Modal Imports
import ScheduleModal from '../components/modals/ScheduleModal'; // Schedule tab (next contact date, Remove Next Call)
import ContactSearchModal from '../components/modals/ContactSearchModal'; // Search for contacts to add
import ContactForm from '../components/modals/ContactForm'; // Add/Edit Contact Modal
import ContactDetailsModal from '../components/modals/ContactDetailsModal'; // View Contact Details Modal
// Get initials for image avatar
const getInitials = (firstName, lastName) => {
	const firstInitial = firstName ? firstName[0] : '';
	const lastInitial = lastName ? lastName[0] : '';
	return (firstInitial + lastInitial).toUpperCase();
};

// Contact Card Component
const ContactCard = ({ contact, onPress, loadContacts }) => {
	const [showActions, setShowActions] = useState(false);

	return (
		<TouchableOpacity
			style={styles.card}
			onPress={() => onPress(contact)}
			onLongPress={() => setShowActions(true)}
			delayLongPress={500}
		>
			<View style={styles.cardAvatar}>
				{contact.photo_url ? (
					Platform.OS === 'web' ? (
						contact.photo_url.startsWith('file://') ? (
							<Text style={styles.avatarText}>{getInitials(contact.first_name, contact.last_name)}</Text>
						) : (
							<ExpoImage
								source={{ uri: contact.photo_url }}
								style={styles.avatarImage}
								cachePolicy="memory-disk"
								transition={200}
							/>
						)
					) : (
						<ExpoImage
							source={{ uri: contact.photo_url }}
							style={styles.avatarImage}
							cachePolicy="memory-disk"
							transition={200}
						/>
					)
				) : (
					<Text style={styles.avatarText}>{getInitials(contact.first_name, contact.last_name)}</Text>
				)}
			</View>

			<View style={styles.nameContainer}>
				<Text style={styles.firstName} numberOfLines={1}>
					{contact.first_name}
				</Text>
				<Text style={styles.lastName} numberOfLines={1}>
					{contact.last_name || ''}
				</Text>
			</View>
			{contact.next_contact && (
				<View style={styles.scheduleBadge}>
					<View style={styles.scheduleDot} />
				</View>
			)}

			{showActions && (
				<View style={styles.actionsContainer}>
					<TouchableOpacity style={styles.closeButton} onPress={() => setShowActions(false)}>
						<Icon name="close" size={24} color={colors.text.primary} />
					</TouchableOpacity>

					<View style={styles.cardActions}>
						<View style={styles.actionButtonsContainer}>
							<TouchableOpacity
								style={styles.cardActionButton}
								onPress={() => {
									Alert.alert(
										'Delete Contact',
										'Are you sure you want to delete this contact? This deletes all call history and cannot be undone.',
										[
											{ text: 'Cancel', style: 'cancel' },
											{
												text: 'Delete',
												style: 'destructive',
												onPress: async () => {
													try {
														await deleteContact(contact.id);
														setShowActions(false);
														await loadContacts();
													} catch (error) {
														console.error('Delete error:', error);
														Alert.alert('Error', 'Unable to delete contact');
													}
												},
											},
										]
									);
								}}
							>
								<Icon name="trash-outline" size={32} color="rgba(255, 0, 0, 0.8)" />
							</TouchableOpacity>

							<TouchableOpacity
								style={styles.cardActionButton}
								onPress={() => {
									Alert.alert('Archive Contact', 'Archive this contact?', [
										{ text: 'Cancel', style: 'cancel' },
										{
											text: 'Archive',
											onPress: async () => {
												try {
													await archiveContact(contact.id);
													setShowActions(false);
													await loadContacts();
												} catch (error) {
													console.error('Archive error:', error);
													Alert.alert('Error', 'Unable to archive contact');
												}
											},
										},
									]);
								}}
							>
								<Icon name="archive" size={32} color={colors.primary} />
							</TouchableOpacity>
						</View>
					</View>
				</View>
			)}
		</TouchableOpacity>
	);
};

// Main Component
export default function ContactsScreen({ navigation }) {
	const { user } = useAuth();
	const [contacts, setContacts] = useState({ scheduledContacts: [], unscheduledContacts: [] });
	const [refreshing, setRefreshing] = useState(false);
	const [loading, setLoading] = useState(true);
	const [isFormVisible, setIsFormVisible] = useState(false);
	const [isDetailsVisible, setIsDetailsVisible] = useState(false);
	const [selectedContact, setSelectedContact] = useState(null);
	const [isScheduleModalVisible, setIsScheduleModalVisible] = useState(false);
	const [deviceContacts, setDeviceContacts] = useState([]);
	const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);

	async function loadContacts() {
		try {
			if (!user) return;
			const contactsList = await fetchContacts(user.uid);
			setContacts(contactsList);
		} catch (error) {
			console.error('Error loading contacts:', error);
			Alert.alert('Error', 'Failed to load contacts');
		} finally {
			setLoading(false);
		}
	}

	const formatPhoneNumber = (phoneNumber) => {
		const cleaned = phoneNumber.replace(/\D/g, '');
		if (cleaned.length === 10) {
			return `+1${cleaned}`;
		} else if (cleaned.length === 11 && cleaned.startsWith('1')) {
			return `+${cleaned}`;
		}
		return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
	};

	const checkForExistingContact = async (phoneNumber) => {
		try {
			const allContacts = [...contacts.scheduledContacts, ...contacts.unscheduledContacts];
			return allContacts.find(
				(contact) => formatPhoneNumber(contact.phone) === formatPhoneNumber(phoneNumber)
			);
		} catch (error) {
			console.error('Error checking for existing contact:', error);
			return null;
		}
	};

	const handleImportContacts = async () => {
		try {
			const { status } = await Contacts.requestPermissionsAsync();
			if (status !== 'granted') {
				Alert.alert('Permission Denied', 'Please enable contact access in your settings to import contacts.');
				return;
			}

			if (Platform.OS === 'ios') {
				const result = await Contacts.presentContactPickerAsync({
					allowsEditing: false,
					fields: [
						Contacts.Fields.FirstName,
						Contacts.Fields.LastName,
						Contacts.Fields.PhoneNumbers,
						Contacts.Fields.Emails,
						Contacts.Fields.Image,
					],
				});

				if (result) {
					await handleContactSelection(result);
				}
			}
		} catch (error) {
			console.error('Error in handleImportContacts:', error);
			Alert.alert('Error', 'Failed to access contacts');
		}
	};

	const handleContactSelection = async (contact) => {
		try {
			const fullContact = await Contacts.getContactByIdAsync(contact.id, [
				Contacts.Fields.FirstName,
				Contacts.Fields.LastName,
				Contacts.Fields.PhoneNumbers,
				Contacts.Fields.Emails,
				Contacts.Fields.Image,
			]);

			const phoneNumber = contact.phoneNumbers?.[0]?.number;
			if (!phoneNumber) {
				Alert.alert('Invalid Contact', 'Selected contact must have a phone number');
				return;
			}

			const formattedPhone = formatPhoneNumber(phoneNumber);

			const existingContact = await checkForExistingContact(formattedPhone);
			if (existingContact) {
				Alert.alert('Duplicate Contact', 'This contact already exists in your list.');
				return;
			}

			let photoUrl = null;
			if (fullContact.imageAvailable && fullContact.image) {
				try {
					const manipResult = await ImageManipulator.manipulateAsync(
						fullContact.image.uri,
						[{ resize: { width: 300, height: 300 } }],
						{ compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
					);

					photoUrl = await uploadContactPhoto(user.uid, manipResult.uri);
					if (!photoUrl || photoUrl.startsWith('file://')) {
						photoUrl = null;
					}
				} catch (photoError) {
					console.error('Photo processing error:', photoError);
				}
			}

			const contactData = {
				first_name: contact.firstName || '',
				last_name: contact.lastName || '',
				phone: formattedPhone,
				email: contact.emails?.[0]?.email || '',
				notes: '',
				contact_history: [],
				tags: [],
				photo_url: photoUrl,
				frequency: 'weekly',
				created_at: serverTimestamp(),
				last_updated: serverTimestamp(),
				user_id: user.uid,
			};

			const newContact = await addContact(user.uid, contactData);
			await loadContacts();
			setSelectedContact(newContact);
			setIsDetailsVisible(true);
		} catch (error) {
			console.error('Contact import error:', error);
			Alert.alert('Error', 'Failed to import contact: ' + error.message);
		}
	};

	useEffect(() => {
		loadContacts();
	}, [user]);

	const onRefresh = React.useCallback(async () => {
		setRefreshing(true);
		await loadContacts();
		setRefreshing(false);
	}, []);

	const handleAddContact = async (formData) => {
		try {
			await addContact(user.uid, formData);

			if (Platform.OS === 'ios') {
				const { status } = await Contacts.requestPermissionsAsync();
				if (status === 'granted') {
					try {
						const contact = {
							[Contacts.Fields.FirstName]: formData.first_name,
							[Contacts.Fields.LastName]: formData.last_name,
							[Contacts.Fields.PhoneNumbers]: [
								{
									label: 'mobile',
									number: formData.phone,
								},
							],
							[Contacts.Fields.Emails]: formData.email
								? [
										{
											label: 'work',
											email: formData.email,
										},
								  ]
								: [],
						};

						await Contacts.addContactAsync(contact);
						Alert.alert('Success', 'Contact added to OnMyList and iOS Contacts');
					} catch (error) {
						console.error('Error adding to iOS contacts:', error);
						Alert.alert('Partial Success', 'Contact added to OnMyList but failed to add to iOS Contacts');
					}
				}
			}

			setIsFormVisible(false);
			loadContacts();
		} catch (error) {
			console.error('Error adding contact:', error);
			Alert.alert('Error', 'Failed to add contact');
		}
	};

	const handleOpenDetails = (contact) => {
		setSelectedContact(contact);
		setIsDetailsVisible(true);
	};

	if (!user) {
		return (
			<View style={commonStyles.container}>
				<Text style={commonStyles.message}>Please log in to view your contacts</Text>
			</View>
		);
	}

	return (
		<SafeAreaView style={commonStyles.container}>
			<StatusBar style="auto" />

			<View style={styles.header}>
				<Image source={Logo} style={styles.logo} resizeMode="contain" />
			</View>

			<View style={styles.buttonContainer}>
				<TouchableOpacity
					style={[commonStyles.primaryButton, styles.importButton]}
					onPress={handleImportContacts}
				>
					<Icon name="people-outline" size={20} color={colors.background.primary} />
					<Text style={commonStyles.primaryButtonText}>Add Contact</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={styles.newButton}
					onPress={() => {
						setIsFormVisible(true);
					}}
				>
					<Icon name="add-outline" size={20} color={colors.primary} />
					<Text style={styles.newButtonText}>New</Text>
				</TouchableOpacity>
			</View>

			<ScrollView
				style={styles.content}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
			>
				{loading ? (
					<Text style={commonStyles.message}>Loading contacts...</Text>
				) : (
					<>
						{contacts.scheduledContacts.length > 0 && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Scheduled Contacts</Text>
								<View style={styles.grid}>
									{contacts.scheduledContacts.map((contact) => (
										<ContactCard
											key={contact.id}
											contact={contact}
											onPress={handleOpenDetails}
											loadContacts={loadContacts}
										/>
									))}
								</View>
							</View>
						)}

						{contacts.unscheduledContacts.length > 0 && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Other Contacts</Text>
								<View style={styles.grid}>
									{contacts.unscheduledContacts.map((contact) => (
										<ContactCard
											key={contact.id}
											contact={contact}
											onPress={handleOpenDetails}
											loadContacts={loadContacts}
										/>
									))}
								</View>
							</View>
						)}

						{contacts.scheduledContacts.length === 0 && contacts.unscheduledContacts.length === 0 && (
							<Text style={commonStyles.message}>No contacts yet</Text>
						)}
					</>
				)}
			</ScrollView>

			<ContactForm
				visible={isFormVisible}
				onClose={() => {
					setIsFormVisible(false);
				}}
				onSubmit={handleAddContact}
				loadContacts={loadContacts}
			/>

			<ContactDetailsModal
				visible={isDetailsVisible}
				contact={selectedContact}
				setSelectedContact={setSelectedContact}
				onClose={() => {
					setIsDetailsVisible(false);
					setSelectedContact(null);
				}}
				loadContacts={loadContacts}
			/>

			<ScheduleModal
				visible={isScheduleModalVisible}
				contact={selectedContact}
				onClose={() => setIsScheduleModalVisible(false)}
				onSubmit={async (date) => {
					try {
						await updateContact(selectedContact.id, {
							next_contact: date.toISOString(),
						});
						loadContacts();
						setIsScheduleModalVisible(false);
						setIsDetailsVisible(false);
						Alert.alert('Success', 'Contact has been scheduled', [
							{
								text: 'OK',
								onPress: () => {
									navigation.navigate('Calendar', { refresh: Date.now() });
								},
							},
						]);
					} catch (error) {
						console.error('Error scheduling contact:', error);
						Alert.alert('Error', 'Failed to schedule contact');
					}
				}}
				setIsDetailsVisible={setIsDetailsVisible}
				loadContacts={loadContacts}
			/>

			<ContactSearchModal
				visible={isSearchModalVisible}
				contacts={deviceContacts}
				onClose={() => setIsSearchModalVisible(false)}
				onSelectContact={(contact) => {
					setIsSearchModalVisible(false);
					handleContactSelection(contact);
				}}
			/>
		</SafeAreaView>
	);
}
