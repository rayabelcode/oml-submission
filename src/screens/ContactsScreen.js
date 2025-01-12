import React, { useState, useEffect, useRef } from 'react';
import { Modal, Image, Dimensions } from 'react-native';
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
	subscribeToContacts,
} from '../utils/firestore';
import { Platform } from 'react-native';
import * as Contacts from 'expo-contacts';
import ImagePickerComponent from '../components/general/ImagePicker';
import { Image as ExpoImage } from 'expo-image';
import { serverTimestamp } from 'firebase/firestore';
import { createContactData, SCHEDULING_CONSTANTS } from '../utils/contactHelpers';
import { formatPhoneNumber } from '../components/general/FormattedPhoneNumber';
import AddContactModal from '../components/contacts/AddContactModal';
import { cacheManager } from '../utils/cache';
import { DEFAULT_RELATIONSHIP_TYPE } from '../../constants/relationships';

// Modal Imports
import ScheduleModal from '../components/modals/ScheduleModal'; // Schedule tab (next contact date, Remove Next Call)
import ContactSearchModal from '../components/modals/ContactSearchModal'; // Search for contacts to add
import ContactForm from '../components/modals/ContactForm'; // Add/Edit Contact Modal
import RelationshipTypeModal from '../components/modals/RelationshipTypeModal'; // Relationship Type Modal
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

	const handlePress = () => {
		if (!isEditing) {
			onPress(contact);
		}
	};

	return (
		<TouchableOpacity
			style={[styles.card, { alignItems: 'center' }]}
			onPress={handlePress}
			onLongPress={() => {
				setIsEditing(true);
				setIsAnyEditing(true);
				setEditingContact(contact);
			}}
			activeOpacity={0.7}
		>
			{contact.next_contact && (
				<View style={styles.scheduleBadge}>
					<View style={styles.scheduleDot} />
				</View>
			)}

			<WobbleEffect
				isEditing={isEditing}
				onDeletePress={handleDeletePress}
				onMeasureDeleteButton={setDeleteButtonPosition}
				style={{ alignItems: 'center' }}
				pointerEvents="none"
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
		</TouchableOpacity>
	);
};

// Main Component
export default function ContactsScreen({ navigation }) {
	const { user } = useAuth();
	const { colors, theme } = useTheme();
	const styles = useStyles();
	const commonStyles = useCommonStyles();

	// Editing state
	const [editingContact, setEditingContact] = useState(null);
	const [isAnyEditing, setIsAnyEditing] = useState(false);
	const [deleteButtonPosition, setDeleteButtonPosition] = useState(null);

	// Search state
	const [showSearch, setShowSearch] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [filteredContacts, setFilteredContacts] = useState({
		scheduledContacts: [],
		unscheduledContacts: [],
	});

	const logoSource =
		theme === 'dark'
			? require('../../assets/full-logo-darkmode.png')
			: require('../../assets/full-logo-color.png');
	const [contacts, setContacts] = useState({ scheduledContacts: [], unscheduledContacts: [] });
	const [refreshing, setRefreshing] = useState(false);
	const [loading, setLoading] = useState(true);
	const [isFormVisible, setIsFormVisible] = useState(false);
	const [showRelationshipModal, setShowRelationshipModal] = useState(false);
	const [pendingContact, setPendingContact] = useState(null);
	const [isScheduleModalVisible, setIsScheduleModalVisible] = useState(false);
	const [deviceContacts, setDeviceContacts] = useState([]);
	const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
	const [showAddModal, setShowAddModal] = useState(false);
	const [unsubscribeRef, setUnsubscribeRef] = useState(null);

	async function loadContacts() {
		try {
			if (!user) {
				setLoading(false);
				return;
			}

			// Try to get cached data first
			const cachedContacts = await cacheManager.getCachedContacts(user.uid);
			if (cachedContacts) {
				setContacts(cachedContacts);
				setLoading(false);
			}

			// Clean up existing subscription if any
			if (unsubscribeRef) {
				unsubscribeRef();
			}

			// Then set up real-time subscription
			const unsubscribe = subscribeToContacts(user.uid, (contactsList) => {
				setContacts(contactsList);
				cacheManager.saveContacts(user.uid, contactsList);
				setLoading(false);
			});

			setUnsubscribeRef(() => unsubscribe);
		} catch (error) {
			console.error('Error in loadContacts:', error);
			Alert.alert('Error', 'Failed to load contacts');
			setLoading(false);
		}
	}

	const checkForExistingContact = async (phoneNumber) => {
		try {
			const allContacts = [...contacts.scheduledContacts, ...contacts.unscheduledContacts];
			const cleanedInput = phoneNumber.replace(/\D/g, '');
			return allContacts.find((contact) => {
				const cleanedContact = contact.phone.replace(/\D/g, '');
				return cleanedInput === cleanedContact;
			});
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

			if (!fullContact.phoneNumbers?.length) {
				Alert.alert('Invalid Contact', 'Selected contact must have a phone number');
				return;
			}

			const phoneNumber = fullContact.phoneNumbers[0].number;
			const cleanedPhone = phoneNumber.replace(/\D/g, '');
			const formattedPhone =
				cleanedPhone.length === 10
					? `+1${cleanedPhone}`
					: cleanedPhone.length === 11 && cleanedPhone.startsWith('1')
					? `+${cleanedPhone}`
					: cleanedPhone.startsWith('+')
					? cleanedPhone
					: `+${cleanedPhone}`;

			const existingContact = await checkForExistingContact(formattedPhone);
			if (existingContact) {
				Alert.alert('Duplicate Contact', 'This contact already exists in your list.');
				return;
			}

			let photoUrl = null;
			if (fullContact.image?.uri) {
				try {
					photoUrl = await uploadContactPhoto(user.uid, fullContact.image.uri);
				} catch (photoError) {
					console.error('Error uploading contact photo:', photoError);
					photoUrl = null;
				}
			}

			setPendingContact({
				first_name: fullContact.firstName || '',
				last_name: fullContact.lastName || '',
				phone: formattedPhone,
				email: fullContact.emails?.[0]?.email || '',
				photo_url: photoUrl,
			});
			setShowRelationshipModal(true);
		} catch (error) {
			console.error('Contact import error:', error);
			Alert.alert('Error', 'Failed to import contact: ' + error.message);
		}
	};

	const processPendingContact = async (relationshipType) => {
		if (!pendingContact) return;

		try {
			const contactData = createContactData(
				{ ...pendingContact, relationship_type: relationshipType || DEFAULT_RELATIONSHIP_TYPE },
				user.uid
			);

			const newContact = await addContact(user.uid, contactData);
			await loadContacts();
			navigation.navigate('ContactDetails', {
				contact: newContact,
				initialTab: 'Schedule', // Add this line to open the Schedule tab
			});
			setPendingContact(null);
		} catch (error) {
			console.error('Error processing contact:', error);
			Alert.alert('Error', 'Failed to add contact');
		}
	};

	useEffect(() => {
		loadContacts();
		return () => {
			if (unsubscribeRef) {
				unsubscribeRef();
			}
		};
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

	const handleAddContact = async (contactData) => {
		try {
			const newContact = await addContact(user.uid, contactData);

			if (Platform.OS === 'ios') {
				const { status } = await Contacts.requestPermissionsAsync();
				if (status === 'granted') {
					try {
						const contact = {
							[Contacts.Fields.FirstName]: contactData.first_name,
							[Contacts.Fields.LastName]: contactData.last_name,
							[Contacts.Fields.PhoneNumbers]: [
								{
									label: 'mobile',
									number: contactData.phone,
								},
							],
							[Contacts.Fields.Emails]: contactData.email
								? [
										{
											label: 'work',
											email: contactData.email,
										},
								  ]
								: [],
						};

						await Contacts.addContactAsync(contact);
					} catch (error) {
						console.error('Error adding to iOS contacts:', error);
						Alert.alert('Partial Success', 'Contact added to OnMyList but failed to add to iOS Contacts');
					}
				}
			}

			setIsFormVisible(false);
			await loadContacts();
			navigation.navigate('ContactDetails', {
				contact: newContact,
				initialTab: 'Schedule',
			});
		} catch (error) {
			console.error('Error adding contact:', error);
			Alert.alert('Error', 'Failed to add contact');
		}
	};

	const handleOpenDetails = (contact) => {
		navigation.navigate('ContactDetails', { contact });
	};

	if (!user) {
		return (
			<View style={commonStyles.container}>
				<Text style={commonStyles.message}>Please log in to view your contacts</Text>
			</View>
		);
	}

	const handleSearch = (text) => {
		setSearchQuery(text);
		if (text.trim() === '') {
			setFilteredContacts(contacts);
			return;
		}

		const query = text.toLowerCase();
		const filtered = {
			scheduledContacts: contacts.scheduledContacts.filter(
				(contact) =>
					`${contact.first_name} ${contact.last_name}`.toLowerCase().includes(query) ||
					contact.email?.toLowerCase().includes(query) ||
					contact.phone?.includes(query)
			),
			unscheduledContacts: contacts.unscheduledContacts.filter(
				(contact) =>
					`${contact.first_name} ${contact.last_name}`.toLowerCase().includes(query) ||
					contact.email?.toLowerCase().includes(query) ||
					contact.phone?.includes(query)
			),
		};
		setFilteredContacts(filtered);
	};

	return (
		<SafeAreaView style={commonStyles.container}>
			<StatusBar style="auto" />

			<View style={styles.header}>
				<View style={styles.headerContent}>
					{/* Logo */}
					<Image source={logoSource} style={styles.logo} resizeMode="contain" />
					{/* Icons */}
					<View style={styles.headerActions}>
						<TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.headerButton}>
							<Icon name="add-outline" size={30} color={colors.text.primary} />
						</TouchableOpacity>
						<TouchableOpacity
    onPress={() => {
        setShowSearch(!showSearch);
        if (showSearch) {
            setSearchQuery('');
            handleSearch('');
        }
    }}
    style={styles.headerButton}
>
    <Icon 
        name={showSearch ? "close" : "search-outline"} 
        size={30} 
        color={showSearch ? '#FF6B6B' : colors.text.primary} 
    />
</TouchableOpacity>

					</View>
				</View>
				{showSearch && (
					<View style={styles.searchContainer}>
						<TextInput
							style={styles.searchInput}
							value={searchQuery}
							onChangeText={handleSearch}
							placeholder="Search Contacts"
							placeholderTextColor={colors.text.secondary}
							autoFocus
							autoCorrect={false}
							spellCheck={false}
							keyboardType="default"
							autoCapitalize="none"
							returnKeyType="search"
							enablesReturnKeyAutomatically={true}
						/>
						{searchQuery.length > 0 && (
							<TouchableOpacity
								style={styles.clearSearchButton}
								onPress={() => {
									setSearchQuery('');
									handleSearch('');
								}}
							>
								<Icon name="close-circle" size={30} color={colors.text.secondary} />
							</TouchableOpacity>
						)}
					</View>
				)}
			</View>
			<ScrollView
				style={styles.content}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
			>
				{loading ? (
					<Text style={commonStyles.message}>Loading contacts...</Text>
				) : (
					<>
						{(searchQuery ? filteredContacts : contacts).scheduledContacts.length > 0 && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Scheduled Contacts</Text>
								<View style={styles.grid}>
									{(searchQuery ? filteredContacts : contacts).scheduledContacts.map((contact) => (
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

						{(searchQuery ? filteredContacts : contacts).unscheduledContacts.length > 0 && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Other Contacts</Text>
								<View style={styles.grid}>
									{(searchQuery ? filteredContacts : contacts).unscheduledContacts.map((contact) => (
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

						{(searchQuery ? filteredContacts : contacts).scheduledContacts.length === 0 &&
							(searchQuery ? filteredContacts : contacts).unscheduledContacts.length === 0 && (
								<Text style={commonStyles.message}>
									{searchQuery ? 'No matching contacts found' : 'No contacts yet'}
								</Text>
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
										onPress: () => {
											Alert.alert(
												'Confirm Delete',
												'All data and call history for this contact will be permanently deleted. This action cannot be undone.',
												[
													{
														text: 'Cancel',
														style: 'cancel',
													},
													{
														text: 'Delete Permanently',
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
												]
											);
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

			<ScheduleModal
				visible={isScheduleModalVisible}
				contact={editingContact}
				onClose={() => setIsScheduleModalVisible(false)}
				onSubmit={async (date) => {
					try {
						await updateContact(editingContact.id, {
							next_contact: date.toISOString(),
						});
						loadContacts();
						setIsScheduleModalVisible(false);
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
				loadContacts={loadContacts}
			/>

			<AddContactModal
				show={showAddModal}
				onClose={() => setShowAddModal(false)}
				onImport={() => {
					setShowAddModal(false);
					handleImportContacts();
				}}
				onNew={() => {
					setShowAddModal(false);
					setIsFormVisible(true);
				}}
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

			<RelationshipTypeModal
				visible={showRelationshipModal}
				onClose={() => {
					setShowRelationshipModal(false);
					setPendingContact(null);
				}}
				onSelect={(relationshipType) => {
					setShowRelationshipModal(false);
					processPendingContact(relationshipType);
				}}
			/>
			<AddContactModal
				show={showAddModal}
				onClose={() => setShowAddModal(false)}
				onImport={() => {
					setShowAddModal(false);
					handleImportContacts();
				}}
				onNew={() => {
					setShowAddModal(false);
					setIsFormVisible(true);
				}}
			/>
			<RelationshipTypeModal
				visible={showRelationshipModal}
				onClose={() => {
					setShowRelationshipModal(false);
					setPendingContact(null);
				}}
				onSelect={(relationshipType) => {
					setShowRelationshipModal(false);
					processPendingContact(relationshipType);
				}}
			/>
		</SafeAreaView>
	);
}
