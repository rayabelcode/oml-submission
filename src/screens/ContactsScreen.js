import React, { useState, useEffect, useRef } from 'react';
import { Modal, Image, Dimensions } from 'react-native';
import DatePicker from 'react-datepicker';
import { SafeAreaView } from 'react-native';
import {
	Text,
	View,
	ScrollView,
	TouchableOpacity,
	TextInput,
	RefreshControl,
	Alert,
	StyleSheet,
} from 'react-native';
import { useStyles } from '../styles/screens/contacts';
import { useCommonStyles } from '../styles/common';
import { useTheme } from '../context/ThemeContext';
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
import ContactDetailsModal from '../components/contacts/ContactDetailsModal'; // View Contact Details Modal
import WobbleEffect from '../components/general/WobbleEffect'; // Wobble effect for contact cards

// Get initials for image avatar
const getInitials = (firstName, lastName) => {
	const firstInitial = firstName ? firstName[0] : '';
	const lastInitial = lastName ? lastName[0] : '';
	return (firstInitial + lastInitial).toUpperCase();
};

// ContactCard component
const ContactCard = ({
	contact,
	onPress,
	loadContacts,
	setIsAnyEditing,
	isAnyEditing,
	setDeleteButtonPosition,
	setEditingContact,
}) => {
	const [isEditing, setIsEditing] = useState(false);
	const { colors } = useTheme();
	const styles = useStyles();

	// Sync with global editing state
	useEffect(() => {
		if (!isAnyEditing) {
			setIsEditing(false);
		}
	}, [isAnyEditing]);

	const handleDeletePress = () => {
		Alert.alert('Contact Options', 'What would you like to do with this contact?', [
			{
				text: 'Archive',
				onPress: async () => {
					try {
						await archiveContact(contact.id);
						setIsEditing(false);
						setIsAnyEditing(false);
						await loadContacts();
					} catch (error) {
						console.error('Archive error:', error);
						Alert.alert('Error', 'Unable to archive contact');
					}
				},
			},
			{
				text: 'Delete',
				style: 'destructive',
				onPress: async () => {
					try {
						await deleteContact(contact.id);
						setIsEditing(false);
						setIsAnyEditing(false);
						await loadContacts();
					} catch (error) {
						console.error('Delete error:', error);
						Alert.alert('Error', 'Unable to delete contact');
					}
				},
			},
			{
				text: 'Cancel',
				style: 'cancel',
				onPress: () => {
					setIsEditing(false);
					setIsAnyEditing(false);
				},
			},
		]);
	};

	return (
		<View style={[styles.card, { alignItems: 'center' }]}>
			{contact.next_contact && (
				<View style={styles.scheduleBadge}>
					<View style={styles.scheduleDot} />
				</View>
			)}

			<WobbleEffect
				isEditing={isEditing}
				onLongPress={() => {
					setIsEditing(true);
					setIsAnyEditing(true);
					setEditingContact(contact);
				}}
				onPress={() => {
					!isEditing && onPress(contact);
				}}
				onDeletePress={handleDeletePress}
				onMeasureDeleteButton={setDeleteButtonPosition}
				style={{ alignItems: 'center' }}
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
			</WobbleEffect>
		</View>
	);
};

// Main Component
export default function ContactsScreen({ navigation }) {
	const { user } = useAuth();
	const { colors, theme } = useTheme();
	const styles = useStyles();
	const commonStyles = useCommonStyles();

	const [editingContact, setEditingContact] = useState(null);
	const [isAnyEditing, setIsAnyEditing] = useState(false);
	const [deleteButtonPosition, setDeleteButtonPosition] = useState(null);

	const logoSource =
		theme === 'dark'
			? require('../../assets/full-logo-darkmode.png')
			: require('../../assets/full-logo-color.png');
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

			// Show relationship type selection before processing the contact
			Alert.alert(
				'Select Relationship Type',
				'What type of relationship do you have with this contact?',
				[
					{
						text: 'Friend',
						onPress: () => processContact(fullContact, formattedPhone, 'friend'),
					},
					{
						text: 'Family',
						onPress: () => processContact(fullContact, formattedPhone, 'family'),
					},
					{
						text: 'Personal',
						onPress: () => processContact(fullContact, formattedPhone, 'personal'),
					},
					{
						text: 'Work',
						onPress: () => processContact(fullContact, formattedPhone, 'work'),
					},
				],
				{ cancelable: false }
			);

			const processContact = async (fullContact, formattedPhone, relationshipType) => {
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
					scheduling: {
						relationship_type: relationshipType,
						frequency: 'weekly',
						custom_schedule: false,
						custom_preferences: {
							preferred_days: [],
							active_hours: {
								start: '09:00',
								end: '17:00',
							},
							excluded_times: [],
						},
						priority: 'normal',
						minimum_gap: 30,
					},
				};

				const newContact = await addContact(user.uid, contactData);
				await loadContacts();
				setSelectedContact(newContact);
				setIsDetailsVisible(true);
			};
		} catch (error) {
			console.error('Contact import error:', error);
			Alert.alert('Error', 'Failed to import contact: ' + error.message);
		}
	};

	useEffect(() => {
		loadContacts();
	}, [user]);

	// Reset editing state when leaving the screen
	useEffect(() => {
		const unsubscribe = navigation.addListener('blur', () => {
			setIsAnyEditing(false);
		});

		return unsubscribe;
	}, [navigation]);

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
				<Image source={logoSource} style={styles.logo} resizeMode="contain" />
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
											setIsAnyEditing={setIsAnyEditing}
											isAnyEditing={isAnyEditing}
											setDeleteButtonPosition={setDeleteButtonPosition}
											setEditingContact={setEditingContact}
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
											setIsAnyEditing={setIsAnyEditing}
											isAnyEditing={isAnyEditing}
											setDeleteButtonPosition={setDeleteButtonPosition}
											setEditingContact={setEditingContact}
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
			{isAnyEditing && (
				<TouchableOpacity
					style={{
						...StyleSheet.absoluteFillObject,
						backgroundColor: 'transparent',
						zIndex: 900,
					}}
					onPress={(e) => {
						if (
							deleteButtonPosition &&
							e.nativeEvent.pageX > deleteButtonPosition.x - 20 &&
							e.nativeEvent.pageX < deleteButtonPosition.x + deleteButtonPosition.width + 20 &&
							e.nativeEvent.pageY > deleteButtonPosition.y - 20 &&
							e.nativeEvent.pageY < deleteButtonPosition.y + deleteButtonPosition.height + 20
						) {
							if (editingContact) {
								Alert.alert('Contact Options', 'What would you like to do with this contact?', [
									{
										text: 'Archive',
										onPress: async () => {
											try {
												await archiveContact(editingContact.id);
												setIsAnyEditing(false);
												setEditingContact(null);
												await loadContacts();
											} catch (error) {
												console.error('Archive error:', error);
												Alert.alert('Error', 'Unable to archive contact');
											}
										},
									},
									{
										text: 'Delete',
										style: 'destructive',
										onPress: async () => {
											try {
												await deleteContact(editingContact.id);
												setIsAnyEditing(false);
												setEditingContact(null);
												await loadContacts();
											} catch (error) {
												console.error('Delete error:', error);
												Alert.alert('Error', 'Unable to delete contact');
											}
										},
									},
									{
										text: 'Cancel',
										style: 'cancel',
										onPress: () => {
											setIsAnyEditing(false);
											setEditingContact(null);
										},
									},
								]);
							}
							return;
						}
						setIsAnyEditing(false);
						setEditingContact(null);
					}}
					activeOpacity={1}
				/>
			)}

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
