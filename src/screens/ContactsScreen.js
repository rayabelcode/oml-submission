import React, { useState, useEffect, useRef } from 'react';
import {
	Alert,
	Dimensions,
	Image,
	Modal,
	Platform,
	RefreshControl,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
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
import * as Contacts from 'expo-contacts';
import ImagePickerComponent from '../components/general/ImagePicker';
import { Image as ExpoImage } from 'expo-image';
import { serverTimestamp } from 'firebase/firestore';
import { createContactData, SCHEDULING_CONSTANTS } from '../utils/contactHelpers';
import { formatPhoneNumber } from '../components/general/FormattedPhoneNumber';
import AddContactModal from '../components/contacts/AddContactModal';
import { cacheManager } from '../utils/cache';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ContactsSortMenu from '../components/general/contactsSort'; // Contacts sort menu
import { RELATIONSHIP_TYPES } from '../../constants/relationships'; // For sorting by relationship type
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
	nameDisplay,
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

	const getDisplayName = (contact) => {
		switch (nameDisplay) {
			case 'firstOnly':
				return { firstName: contact.first_name, lastName: '' };
			case 'initials':
				return {
					firstName: getInitials(contact.first_name, contact.last_name),
					lastName: '',
				};
			default:
				return {
					firstName: contact.first_name,
					lastName: contact.last_name || '',
				};
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
					{(() => {
						const displayName = getDisplayName(contact);
						return (
							<>
								<Text
									style={styles.firstName}
									numberOfLines={1}
									adjustsFontSizeToFit={true}
									minimumFontScale={0.8}
								>
									{displayName.firstName}
								</Text>
								{displayName.lastName && (
									<Text
										style={styles.lastName}
										numberOfLines={1}
										adjustsFontSizeToFit={true}
										minimumFontScale={0.8}
									>
										{displayName.lastName}
									</Text>
								)}
							</>
						);
					})()}
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

	// contactsSort states
	const [sortType, setSortType] = useState('firstName'); // 'firstName' or 'lastName'
	const [groupBy, setGroupBy] = useState('schedule'); // 'schedule', 'relationship', or 'none'
	const [nameDisplay, setNameDisplay] = useState('full'); // 'full', 'firstOnly', or 'initials'
	const [showSortMenu, setShowSortMenu] = useState(false);

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

	const organizeContacts = (contactsList) => {
		let allContacts = [...contactsList.scheduledContacts, ...contactsList.unscheduledContacts];

		// Apply sorting
		allContacts.sort((a, b) => {
			if (sortType === 'firstName') {
				return a.first_name.localeCompare(b.first_name);
			} else {
				return (a.last_name || '').localeCompare(b.last_name || '');
			}
		});

		// Apply grouping
		if (groupBy === 'schedule') {
			return {
				scheduledContacts: allContacts.filter((contact) => contact.next_contact),
				unscheduledContacts: allContacts.filter((contact) => !contact.next_contact),
			};
		} else if (groupBy === 'relationship') {
			const grouped = {};
			Object.keys(RELATIONSHIP_TYPES).forEach((type) => {
				grouped[type] = allContacts.filter((contact) => contact.scheduling?.relationship_type === type);
			});
			return grouped;
		} else {
			return { all: allContacts };
		}
	};

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
				initialTab: 'Schedule',
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

	useEffect(() => {
		const loadViewSettings = async () => {
			try {
				const settings = await AsyncStorage.getItem('contactViewSettings');
				if (settings) {
					const {
						sortType: savedSort,
						groupBy: savedGroup,
						nameDisplay: savedDisplay,
					} = JSON.parse(settings);
					setSortType(savedSort);
					setGroupBy(savedGroup);
					setNameDisplay(savedDisplay);
				}
			} catch (error) {
				console.error('Error loading view settings:', error);
			}
		};

		loadViewSettings();
	}, []);

	useEffect(() => {
		const saveViewSettings = async () => {
			try {
				await AsyncStorage.setItem(
					'contactViewSettings',
					JSON.stringify({
						sortType,
						groupBy,
						nameDisplay,
					})
				);
			} catch (error) {
				console.error('Error saving view settings:', error);
			}
		};

		saveViewSettings();
	}, [sortType, groupBy, nameDisplay]);

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

	const renderContacts = () => {
		const organizedContacts = organizeContacts(searchQuery ? filteredContacts : contacts);

		if (groupBy === 'none') {
			return (
				<View style={styles.section}>
					<View style={styles.grid}>
						{organizedContacts.all?.map((contact) => (
							<ContactCard
								key={contact.id}
								contact={contact}
								onPress={handleOpenDetails}
								loadContacts={loadContacts}
								setIsAnyEditing={setIsAnyEditing}
								isAnyEditing={isAnyEditing}
								setDeleteButtonPosition={setDeleteButtonPosition}
								setEditingContact={setEditingContact}
								nameDisplay={nameDisplay}
							/>
						))}
					</View>
				</View>
			);
		}

		if (groupBy === 'relationship') {
			const relationshipGroups = Object.entries(organizedContacts).map(([type, contacts]) => {
				if (contacts.length === 0) return null;
				return (
					<View key={type} style={styles.section}>
						<View style={styles.groupHeader}>
							<View style={styles.relationshipHeader}>
								<Icon name={RELATIONSHIP_TYPES[type].icon} size={22} color={RELATIONSHIP_TYPES[type].color} />
								<Text style={styles.relationshipTitle}>{RELATIONSHIP_TYPES[type].label}</Text>
							</View>
						</View>

						<View style={styles.grid}>
							{contacts.map((contact) => (
								<ContactCard
									key={contact.id}
									contact={contact}
									onPress={handleOpenDetails}
									loadContacts={loadContacts}
									setIsAnyEditing={setIsAnyEditing}
									isAnyEditing={isAnyEditing}
									setDeleteButtonPosition={setDeleteButtonPosition}
									setEditingContact={setEditingContact}
									nameDisplay={nameDisplay}
								/>
							))}
						</View>
					</View>
				);
			});

			// If all groups are empty - show message
			if (relationshipGroups.every((group) => group === null)) {
				return (
					<View style={styles.section}>
						<Text style={commonStyles.message}>Add some contacts to get started!</Text>
					</View>
				);
			}

			return relationshipGroups;
		}

		return (
			<>
				{organizedContacts.scheduledContacts.length > 0 && (
					<View style={styles.section}>
						<View style={styles.groupHeader}>
							<Text style={styles.groupTitle}>Scheduled</Text>
						</View>
						<View style={styles.grid}>
							{organizedContacts.scheduledContacts.map((contact) => (
								<ContactCard
									key={contact.id}
									contact={contact}
									onPress={handleOpenDetails}
									loadContacts={loadContacts}
									setIsAnyEditing={setIsAnyEditing}
									isAnyEditing={isAnyEditing}
									setDeleteButtonPosition={setDeleteButtonPosition}
									setEditingContact={setEditingContact}
									nameDisplay={nameDisplay}
								/>
							))}
						</View>
					</View>
				)}

				{organizedContacts.unscheduledContacts.length > 0 && (
					<View style={styles.section}>
						<View style={styles.groupHeader}>
							<Text style={styles.groupTitle}>Unscheduled</Text>
						</View>
						<View style={styles.grid}>
							{organizedContacts.unscheduledContacts.map((contact) => (
								<ContactCard
									key={contact.id}
									contact={contact}
									onPress={handleOpenDetails}
									loadContacts={loadContacts}
									setIsAnyEditing={setIsAnyEditing}
									isAnyEditing={isAnyEditing}
									setDeleteButtonPosition={setDeleteButtonPosition}
									setEditingContact={setEditingContact}
									nameDisplay={nameDisplay}
								/>
							))}
						</View>
					</View>
				)}
			</>
		);
	};

	return (
		<SafeAreaView style={commonStyles.container}>
			<StatusBar style="auto" />

			<View style={styles.header}>
				<View style={styles.headerContent}>
					<TouchableOpacity
						onPress={() => setShowSortMenu(true)}
						style={styles.leftHeader}
						activeOpacity={0.7}
					>
						<Icon name="menu" size={30} color={colors.text.primary} />
						<Image source={logoSource} style={styles.logo} resizeMode="contain" />
					</TouchableOpacity>

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
								name={showSearch ? 'close' : 'search-outline'}
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
				keyboardShouldPersistTaps="handled"
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
			>
				{loading ? <Text style={commonStyles.message}>Loading contacts...</Text> : renderContacts()}
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

			<ContactSearchModal
				visible={isSearchModalVisible}
				contacts={deviceContacts}
				onClose={() => setIsSearchModalVisible(false)}
				onSelectContact={(contact) => {
					setIsSearchModalVisible(false);
					handleContactSelection(contact);
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

			<ContactsSortMenu
				visible={showSortMenu}
				onClose={() => setShowSortMenu(false)}
				sortType={sortType}
				groupBy={groupBy}
				nameDisplay={nameDisplay}
				onSortTypeChange={setSortType}
				onGroupByChange={setGroupBy}
				onNameDisplayChange={setNameDisplay}
			/>
		</SafeAreaView>
	);
}
