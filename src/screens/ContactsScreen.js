import React, { useState, useEffect, useRef } from 'react';
import { Modal, Image, Dimensions } from 'react-native';
import DatePicker from 'react-datepicker';
import { SafeAreaView } from 'react-native';
import '../../assets/react-datepicker.css';
import {
	StyleSheet,
	Text,
	View,
	ScrollView,
	TouchableOpacity,
	TextInput,
	RefreshControl,
	Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import {
	fetchContacts,
	deleteContact,
	addContact,
	updateContact,
	addContactHistory,
	fetchContactHistory,
} from '../utils/firestore';
import Logo from '../../assets/full-logo-color.png';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';
import { generateTopicSuggestions } from '../utils/ai';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Caching AI suggestions
import * as Contacts from 'expo-contacts'; // Import Contacts API
import * as ImageManipulator from 'expo-image-manipulator'; // Image resizing
import { Image as ExpoImage } from 'expo-image';
import { serverTimestamp } from 'firebase/firestore';

// Screen width for grid calculation
const windowWidth = Dimensions.get('window').width;
const numColumns = 3;
const cardMargin = 10;
const cardWidth = (windowWidth - cardMargin * (numColumns + 1)) / numColumns;

// Schedule Modal Component
const ScheduleModal = ({ visible, contact, onClose, onSubmit }) => {
	const [selectedDate, setSelectedDate] = useState(new Date());
	const [showPicker, setShowPicker] = useState(false);

	const handleConfirm = () => {
		onSubmit(selectedDate);
	};

	return (
		<Modal visible={visible} animationType="slide" transparent={true}>
			<View style={styles.modalContainer}>
				<View style={styles.modalContent}>
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>Schedule Contact</Text>
						<TouchableOpacity onPress={onClose}>
							<Icon name="close-outline" size={24} color="#666" />
						</TouchableOpacity>
					</View>

					<View style={styles.modalScroll}>
						<Text style={styles.label}>Select Next Contact Date:</Text>

						{/* Web Platform */}
						{Platform.OS === 'web' ? (
							<DatePicker
								selected={selectedDate}
								onChange={(date) => {
									const newDate = new Date(date);
									newDate.setHours(12, 0, 0, 0);
									setSelectedDate(newDate);
									setShowPicker(false);
								}}
								inline
								dateFormat="MM/dd/yyyy"
							/>
						) : (
							/* iOS/Android Native Date Picker */
							<>
								<TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(true)}>
									<Text style={styles.dateButtonText}>
										{selectedDate.toDateString() === new Date().toDateString()
											? 'Today'
											: selectedDate.toLocaleDateString()}
									</Text>
								</TouchableOpacity>

								{Platform.OS === 'ios' && showPicker && (
									<DateTimePicker
										value={selectedDate}
										mode="date"
										display="inline"
										onChange={(event, date) => {
											if (date) {
												const newDate = new Date(date);
												newDate.setHours(12, 0, 0, 0);
												setSelectedDate(newDate);
											}
										}}
										textColor="#000000"
										accentColor="#007AFF"
										themeVariant="light"
										style={{
											height: 400,
											width: '100%',
											backgroundColor: 'white',
										}}
									/>
								)}

								{Platform.OS === 'android' && showPicker && (
									<DateTimePicker
										value={selectedDate}
										mode="date"
										display="default"
										onChange={(event, date) => {
											setShowPicker(false);
											if (event.type === 'set') {
												const newDate = new Date(date);
												newDate.setHours(12, 0, 0, 0);
												setSelectedDate(newDate);
											}
										}}
									/>
								)}
							</>
						)}

						<TouchableOpacity
							style={[styles.modalButton, styles.saveButton, { marginTop: 20 }]}
							onPress={handleConfirm}
						>
							<Text style={styles.buttonText}>Confirm Schedule</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</Modal>
	);
};

// Contact Card Component
const ContactCard = ({ contact, onPress }) => {
	const getInitials = (firstName, lastName) => {
		const firstInitial = firstName ? firstName[0] : '';
		const lastInitial = lastName ? lastName[0] : '';
		return (firstInitial + lastInitial).toUpperCase();
	};

	const fullName = `${contact.first_name} ${contact.last_name || ''}`.trim();

	return (
		<TouchableOpacity style={styles.card} onPress={() => onPress(contact)}>
			<View style={styles.cardAvatar}>
				{contact.photo_url ? (
					<ExpoImage
						source={{ uri: contact.photo_url }}
						style={styles.avatarImage}
						cachePolicy="memory-disk"
						transition={200}
					/>
				) : (
					<Text style={styles.avatarText}>{getInitials(contact.first_name, contact.last_name)}</Text>
				)}
			</View>
			<Text style={styles.cardName} numberOfLines={1}>
				{fullName}
			</Text>
			{contact.next_contact && (
				<View style={styles.scheduleBadge}>
					<View style={styles.scheduleDot} />
				</View>
			)}
		</TouchableOpacity>
	);
};

const TagsModal = ({ visible, onClose, tags, onAddTag, onDeleteTag }) => {
	const [newTag, setNewTag] = useState('');

	const handleAddTag = () => {
		if (newTag.trim()) {
			onAddTag(newTag.trim());
			setNewTag('');
		}
	};

	const handleKeyPress = (e) => {
		if (e.key === 'Enter' && newTag.trim()) {
			handleAddTag();
		}
	};

	return (
		<Modal visible={visible} animationType="slide" transparent={true}>
			<View style={styles.modalContainer}>
				<View style={styles.modalContent}>
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>Current Tags</Text>
						<TouchableOpacity onPress={onClose}>
							<Icon name="close-outline" size={24} color="#666" />
						</TouchableOpacity>
					</View>

					<View style={styles.tagsContainer}>
						{tags?.map((tag, index) => (
							<View key={index} style={styles.tagBubble}>
								<Text style={styles.tagText}>{tag}</Text>
								<TouchableOpacity onPress={() => onDeleteTag(tag)}>
									<Icon name="close-circle" size={20} color="#666" />
								</TouchableOpacity>
							</View>
						))}
					</View>

					<View style={styles.tagInputContainer}>
						<TextInput
							style={styles.tagInput}
							placeholder="Type new tag..."
							value={newTag}
							onChangeText={setNewTag}
							onKeyPress={handleKeyPress}
							onSubmitEditing={handleAddTag}
						/>
						<TouchableOpacity
							style={[styles.tagButton, !newTag.trim() && styles.tagButtonDisabled]}
							onPress={handleAddTag}
							disabled={!newTag.trim()}
						>
							<Text style={styles.buttonText}>Add</Text>
						</TouchableOpacity>
					</View>

					<TouchableOpacity style={styles.doneButton} onPress={onClose}>
						<Text style={styles.buttonText}>Done</Text>
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	);
};

const ContactSearchModal = ({ visible, onClose, contacts, onSelectContact }) => {
	const [searchText, setSearchText] = useState('');
	const [filteredContacts, setFilteredContacts] = useState([]);

	useEffect(() => {
		if (searchText) {
			const filtered = contacts.filter((contact) => {
				const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
				return fullName.includes(searchText.toLowerCase());
			});
			setFilteredContacts(filtered);
		} else {
			setFilteredContacts([]);
		}
	}, [searchText, contacts]);

	return (
		<Modal visible={visible} animationType="slide" transparent={true}>
			<View style={styles.modalContainer}>
				<View style={styles.modalContent}>
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>Search Contacts</Text>
						<TouchableOpacity onPress={onClose}>
							<Icon name="close-outline" size={24} color="#666" />
						</TouchableOpacity>
					</View>

					<TextInput
						style={styles.searchInput}
						placeholder="Search by name..."
						value={searchText}
						onChangeText={setSearchText}
						autoFocus={true}
					/>

					<ScrollView style={styles.searchResults}>
						{filteredContacts.map((contact, index) => (
							<TouchableOpacity
								key={index}
								style={styles.searchResultItem}
								onPress={() => onSelectContact(contact)}
							>
								<Text style={styles.searchResultText}>
									{`${contact.firstName || ''} ${contact.lastName || ''}`.trim()}
								</Text>
							</TouchableOpacity>
						))}
					</ScrollView>
				</View>
			</View>
		</Modal>
	);
};

const ContactDetailsModal = ({ visible, contact, setSelectedContact, onClose, onEdit, onSchedule }) => {
	const [history, setHistory] = useState([]); // Contact history notes
	const [notes, setNotes] = useState(''); // Contact notes
	const [editMode, setEditMode] = useState(null); // Track editing state
	const [callNotes, setCallNotes] = useState(''); // Call notes text
	const [callDate, setCallDate] = useState(new Date()); // Call date
	const [showDatePicker, setShowDatePicker] = useState(false); //Date picker for call notes
	const [suggestions, setSuggestions] = useState([]); // Holds AI-generated topic suggestions
	const [loadingSuggestions, setLoadingSuggestions] = useState(false); // Tracks loading state for suggestions
	const [suggestionCache, setSuggestionCache] = useState({}); // Cache for AI suggestions
	const [isTagsModalVisible, setIsTagsModalVisible] = useState(false); // Tags modal state

	// Fetch Contact History
	useEffect(() => {
		if (contact?.id) {
			fetchContactHistory(contact?.id).then((history) => {
				// Sort history with newest first
				const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
				setHistory(sortedHistory);
			});
		}
	}, [contact]);

	// Load cached suggestions from storage
	useEffect(() => {
		const loadCache = async () => {
			try {
				const cached = await AsyncStorage.getItem('suggestionCache');
				if (cached) {
					setSuggestionCache(JSON.parse(cached));
				}
			} catch (error) {
				console.error('Error loading suggestion cache:', error);
			}
		};
		loadCache();
	}, []);

	// Fetch AI Topic Suggestions
	useEffect(() => {
		if (visible && contact?.id) {
			const cached = suggestionCache[contact.id];

			// Use cached suggestions if available
			if (cached) {
				setSuggestions(cached.suggestions);
				return;
			}

			// Initialize for first-time viewing
			if (!contact.contact_history?.length) {
				setSuggestions(['No conversation history yet. Start your first conversation!']);
				return;
			}

			// Only fetch if no cache exists
			setLoadingSuggestions(true);
			generateTopicSuggestions(contact, contact.contact_history)
				.then(async (topics) => {
					const newCache = {
						...suggestionCache,
						[contact.id]: {
							suggestions: topics,
							historyLength: contact.contact_history.length,
							timestamp: Date.now(),
						},
					};
					setSuggestionCache(newCache);
					setSuggestions(topics);

					// Save to AsyncStorage
					try {
						await AsyncStorage.setItem('suggestionCache', JSON.stringify(newCache));
					} catch (error) {
						console.error('Error saving suggestion cache:', error);
					}
				})
				.catch((error) => {
					console.error('Error fetching topic suggestions:', error);
					setSuggestions(['Unable to generate suggestions at this time.']);
				})
				.finally(() => {
					setLoadingSuggestions(false);
				});
		}
	}, [visible, contact?.id, suggestionCache]);

	// If contact does not exist, return nothing
	if (!contact) {
		return null;
	}

	// Edit a specific history note
	const handleEditHistory = async (index, updatedNote) => {
		try {
			const updatedHistory = [...history];
			updatedHistory[index].notes = updatedNote;

			await updateContact(contact.id, { contact_history: updatedHistory });
			setHistory(updatedHistory);
			setEditMode(null);
			Alert.alert('Success', 'Contact history updated');
		} catch (error) {
			console.error('Error editing history:', error);
			Alert.alert('Error', 'Failed to update contact history');
		}
	};

	const handleDeleteHistory = async (index) => {
		try {
			const updatedHistory = history.filter((_, i) => i !== index);

			// Update both contact and contact_history in Firestore
			await updateContact(contact.id, {
				contact_history: updatedHistory,
			});

			// Update local state
			setHistory(updatedHistory);

			// Update the contact object with new history
			const updatedContact = {
				...contact,
				contact_history: updatedHistory,
			};
			setSelectedContact(updatedContact);

			// Refresh suggestions
			delete suggestionCache.current[contact.id];
			const topics = await generateTopicSuggestions(updatedContact, updatedHistory);
			setSuggestions(topics);

			Alert.alert('Success', 'History entry deleted');
		} catch (error) {
			console.error('Error deleting history:', error);
			Alert.alert('Error', 'Failed to delete history entry');
		}
	};

	const handleAddCallNotes = async (notes, date) => {
		if (!notes.trim()) {
			Alert.alert('Error', 'Please enter the call notes');
			return;
		}

		try {
			// Create local date with time set to noon to avoid timezone issues
			const localDate = new Date(date);
			localDate.setHours(12, 0, 0, 0);

			// Format date as YYYY-MM-DD
			const dateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(
				2,
				'0'
			)}-${String(localDate.getDate()).padStart(2, '0')}`;

			// Add new call history to Firestore
			await addContactHistory(contact.id, {
				notes,
				date: dateStr,
			});

			// Refresh the history immediately
			const updatedHistory = await fetchContactHistory(contact.id);
			const sortedHistory = [...updatedHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
			setHistory(sortedHistory);

			// Update contact in state with new history
			const updatedContact = {
				...contact,
				contact_history: sortedHistory,
			};
			setSelectedContact(updatedContact);

			// Refresh suggestions after new call note
			setLoadingSuggestions(true);
			try {
				const topics = await generateTopicSuggestions(updatedContact, sortedHistory);
				const newCache = {
					...suggestionCache,
					[contact.id]: {
						suggestions: topics,
						historyLength: sortedHistory.length,
						timestamp: Date.now(),
					},
				};
				setSuggestionCache(newCache);
				setSuggestions(topics);

				// Save to AsyncStorage
				await AsyncStorage.setItem('suggestionCache', JSON.stringify(newCache));
			} catch (error) {
				console.error('Error updating suggestions:', error);
				setSuggestions(['Unable to generate suggestions at this time.']);
			} finally {
				setLoadingSuggestions(false);
			}

			// Reset form
			setCallNotes('');
			setCallDate(new Date());

			Alert.alert('Success', 'Call notes added!');
		} catch (error) {
			console.error('Error adding call notes:', error);
			Alert.alert('Error', 'Failed to add call notes');
		}
	};

	return (
		<Modal visible={visible} animationType="slide" transparent={true}>
			<View style={styles.modalContainer}>
				<View style={styles.modalContent}>
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>
							{contact.first_name} {contact.last_name}
						</Text>
						<TouchableOpacity onPress={onClose}>
							<Icon name="close-outline" size={24} color="#666" />
						</TouchableOpacity>
					</View>

					<ScrollView style={styles.modalScroll}>
						{/* Call Notes Section */}
						<View style={styles.callNotesSection}>
							<TextInput
								style={styles.callNotesInput}
								multiline
								value={callNotes}
								onChangeText={setCallNotes}
								placeholder="What did you discuss?"
								placeholderTextColor="#666666"
							/>
							<View style={styles.callNotesControls}>
								<TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
									<Text style={styles.dateButtonText}>
										{callDate.toDateString() === new Date().toDateString()
											? 'Today'
											: callDate.toLocaleDateString()}
									</Text>
								</TouchableOpacity>
								<TouchableOpacity
									style={styles.submitCallButton}
									onPress={() => handleAddCallNotes(callNotes, callDate)}
								>
									<Text style={styles.buttonText}>Submit</Text>
								</TouchableOpacity>
							</View>
						</View>
						{/* Date Picker Modal */}
						<Modal visible={showDatePicker} transparent={true} animationType="fade">
							<TouchableOpacity
								style={styles.datePickerModalOverlay}
								onPress={() => setShowDatePicker(false)}
								activeOpacity={1}
							>
								<View style={styles.datePickerContainer} onClick={(e) => e.stopPropagation()}>
									{Platform.OS === 'web' ? (
										<DatePicker
											selected={callDate}
											onChange={(date) => {
												const newDate = new Date(date);
												newDate.setHours(12, 0, 0, 0);
												setCallDate(newDate);
												setShowDatePicker(false);
											}}
											inline
											dateFormat="MM/dd/yyyy"
											renderCustomHeader={({
												date,
												decreaseMonth,
												increaseMonth,
												prevMonthButtonDisabled,
												nextMonthButtonDisabled,
											}) => (
												<div
													style={{
														display: 'flex',
														justifyContent: 'space-between',
														alignItems: 'center',
														padding: '10px',
													}}
												>
													<button
														onClick={decreaseMonth}
														disabled={prevMonthButtonDisabled}
														style={{
															border: 'none',
															background: 'none',
															cursor: 'pointer',
														}}
													>
														<Icon
															name="chevron-back-outline"
															size={24}
															color={prevMonthButtonDisabled ? '#ccc' : '#007AFF'}
														/>
													</button>
													<span style={{ fontWeight: '500', fontSize: '16px' }}>
														{date.toLocaleString('default', { month: 'long', year: 'numeric' })}
													</span>
													<button
														onClick={increaseMonth}
														disabled={nextMonthButtonDisabled}
														style={{
															border: 'none',
															background: 'none',
															cursor: 'pointer',
														}}
													>
														<Icon
															name="chevron-forward-outline"
															size={24}
															color={nextMonthButtonDisabled ? '#ccc' : '#007AFF'}
														/>
													</button>
												</div>
											)}
										/>
									) : Platform.OS === 'ios' ? (
										<DateTimePicker
											value={callDate}
											mode="date"
											display="inline"
											onChange={(event, date) => {
												if (date) {
													const newDate = new Date(date);
													newDate.setHours(12, 0, 0, 0);
													setCallDate(newDate);
												}
												if (event.type === 'set') {
													setShowDatePicker(false);
												}
											}}
											textColor="#000000"
											accentColor="#007AFF"
											themeVariant="light"
											style={{
												height: 400,
												width: '100%',
												backgroundColor: 'white',
											}}
										/>
									) : (
										<DateTimePicker
											value={callDate}
											mode="date"
											display="default"
											onChange={(event, date) => {
												setShowDatePicker(false);
												if (event.type === 'set' && date) {
													const newDate = new Date(date);
													newDate.setHours(12, 0, 0, 0);
													setCallDate(newDate);
												}
											}}
										/>
									)}
								</View>
							</TouchableOpacity>
						</Modal>

						{/* AI Suggestions */}
						{loadingSuggestions ? (
							<Text style={styles.suggestionsText}>Loading suggestions...</Text>
						) : (
							<View style={styles.suggestionsContainer}>
								<Text style={styles.suggestionsTitle}>Suggested Topics:</Text>
								{suggestions.map((topic, index) => (
									<Text key={index} style={styles.suggestion}>
										• {topic}
									</Text>
								))}
							</View>
						)}

						{/* Contact History */}
						<View style={styles.historySection}>
							<Text style={styles.sectionTitle}>Contact History</Text>
							{history.map((entry, index) => (
								<View key={index} style={styles.historyEntry}>
									<Text style={styles.historyDate}>{new Date(entry.date).toLocaleDateString()}</Text>
									{editMode === index ? (
										<TextInput
											style={styles.historyNotesInput}
											value={entry.notes}
											onChangeText={(text) => {
												const updatedHistory = [...history];
												updatedHistory[index].notes = text;
												setHistory(updatedHistory);
											}}
										/>
									) : (
										<Text style={styles.historyNotes}>{entry.notes}</Text>
									)}
									<View style={styles.historyActions}>
										<TouchableOpacity
											style={styles.editButton}
											onPress={() =>
												editMode === index ? handleEditHistory(index, entry.notes) : setEditMode(index)
											}
										>
											<Text style={styles.buttonText}>{editMode === index ? 'Save' : 'Edit'}</Text>
										</TouchableOpacity>
										<TouchableOpacity
											style={styles.deleteButton}
											onPress={() => {
												if (Platform.OS === 'web') {
													if (window.confirm('Are you sure you want to delete this entry?')) {
														handleDeleteHistory(index);
													}
												} else {
													Alert.alert('Delete Entry', 'Are you sure you want to delete this entry?', [
														{ text: 'Cancel', style: 'cancel' },
														{
															text: 'Delete',
															style: 'destructive',
															onPress: () => handleDeleteHistory(index),
														},
													]);
												}
											}}
										>
											<Text style={styles.buttonText}>Delete</Text>
										</TouchableOpacity>
									</View>
								</View>
							))}
						</View>
					</ScrollView>

					{/* Footer Buttons */}
					<View style={styles.modalActions}>
						<TouchableOpacity
							style={[styles.modalButton, styles.scheduleButton]}
							onPress={() => onSchedule(contact)}
						>
							<Icon name="calendar-outline" size={20} color="#fff" />
							<Text style={styles.buttonText}>Schedule</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[styles.modalButton, styles.tagsButton]}
							onPress={() => setIsTagsModalVisible(true)}
						>
							<Icon name="pricetag-outline" size={20} color="#fff" />
							<Text style={styles.buttonText}>Tags</Text>
						</TouchableOpacity>

						<TouchableOpacity style={[styles.modalButton, styles.editButton]} onPress={() => onEdit(contact)}>
							<Icon name="create-outline" size={20} color="#fff" />
							<Text style={styles.buttonText}>Edit</Text>
						</TouchableOpacity>
					</View>

					{/* Tags Modal */}
					<TagsModal
						visible={isTagsModalVisible}
						onClose={() => setIsTagsModalVisible(false)}
						tags={contact.tags || []}
						onAddTag={async (tag) => {
							const updatedTags = [...(contact.tags || []), tag];
							await updateContact(contact.id, { tags: updatedTags });
							setSelectedContact({ ...contact, tags: updatedTags });
						}}
						onDeleteTag={async (tagToDelete) => {
							const updatedTags = (contact.tags || []).filter((tag) => tag !== tagToDelete);
							await updateContact(contact.id, { tags: updatedTags });
							setSelectedContact({ ...contact, tags: updatedTags });
						}}
					/>
				</View>
			</View>
		</Modal>
	);
};

// Add/Edit Contact Modal
const ContactForm = ({ visible, onClose, onSubmit, initialData = null }) => {
	const [formData, setFormData] = useState({
		first_name: '',
		last_name: '',
		email: '',
		phone: '',
		frequency: 'weekly',
	});

	useEffect(() => {
		if (initialData) {
			setFormData({
				first_name: initialData.first_name || '',
				last_name: initialData.last_name || '',
				email: initialData.email || '',
				phone: initialData.phone || '',
				frequency: initialData.frequency || 'weekly',
				notes: initialData.notes || '',
			});
		} else {
			// Reset form when modal is opened/closed
			setFormData({
				first_name: '',
				last_name: '',
				email: '',
				phone: '',
				frequency: 'weekly',
				notes: '',
			});
		}
	}, [initialData, visible]);

	return (
		<Modal visible={visible} animationType="slide" transparent={true}>
			<View style={styles.modalContainer}>
				<View style={styles.modalContent}>
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>{initialData ? 'Edit Contact' : 'Add New Contact'}</Text>
						<TouchableOpacity onPress={onClose}>
							<Icon name="close-outline" size={24} color="#666" />
						</TouchableOpacity>
					</View>

					<ScrollView style={styles.modalScroll}>
						<TextInput
							style={styles.input}
							placeholder="First Name"
							value={formData.first_name}
							onChangeText={(text) => setFormData({ ...formData, first_name: text })}
						/>

						<TextInput
							style={styles.input}
							placeholder="Last Name"
							value={formData.last_name}
							onChangeText={(text) => setFormData({ ...formData, last_name: text })}
						/>

						<TextInput
							style={styles.input}
							placeholder="Email"
							value={formData.email}
							onChangeText={(text) => setFormData({ ...formData, email: text })}
							keyboardType="email-address"
							autoCapitalize="none"
						/>

						<TextInput
							style={styles.input}
							placeholder="Phone"
							value={formData.phone}
							onChangeText={(text) => setFormData({ ...formData, phone: text })}
							keyboardType="phone-pad"
						/>
					</ScrollView>

					<View style={styles.modalActions}>
						<TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onClose}>
							<Text style={styles.buttonText}>Cancel</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.modalButton, styles.saveButton]}
							onPress={() => {
								if (!formData.first_name.trim()) {
									Alert.alert('Error', 'First name is required');
									return;
								}
								onSubmit(formData);
							}}
						>
							<Text style={styles.buttonText}>Save</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</Modal>
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
	const [editingContact, setEditingContact] = useState(null);
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

	// Format phone number to E.164 standard
	const formatPhoneNumber = (phoneNumber) => {
		// Remove all non-numeric characters
		const cleaned = phoneNumber.replace(/\D/g, '');

		// Handle US/Canada numbers
		if (cleaned.length === 10) {
			return `+1${cleaned}`;
		} else if (cleaned.length === 11 && cleaned.startsWith('1')) {
			return `+${cleaned}`;
		}

		// Return international numbers as-is with + prefix
		return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
	};

	// Check for existing contact by phone number
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

	// Validate phone number
	const isValidPhoneNumber = (phoneNumber) => {
		const cleaned = phoneNumber.replace(/\D/g, '');
		// Basic validation for US/Canada numbers
		if (cleaned.length === 10 || (cleaned.length === 11 && cleaned.startsWith('1'))) {
			return true;
		}
		// Basic validation for international numbers (>= 10 digits)
		return cleaned.length >= 10;
	};

	// Handle contact import
	const handleImportContacts = async () => {
		try {
			console.log('Starting contact import...');
			const { status } = await Contacts.requestPermissionsAsync();
			if (status !== 'granted') {
				Alert.alert('Permission Denied', 'Please enable contact access in your settings to import contacts.');
				return;
			}

			if (Platform.OS === 'ios') {
				console.log('Opening iOS contact picker...');
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

				console.log('Contact picker result:', result);
				// Note the change here - we pass the contact directly
				await handleContactSelection(result);
			} else {
				// Android fallback code...
			}
		} catch (error) {
			console.error('Error in handleImportContacts:', error);
			Alert.alert('Error', 'Failed to access contacts');
		}
	};

	// Show contact picker
	const showContactPicker = async (contacts) => {
		// Sort contacts by first name
		const sortedContacts = contacts
			.filter((contact) => contact.firstName || contact.lastName)
			.sort((a, b) => {
				const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim();
				const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim();
				return nameA.localeCompare(nameB);
			});

		if (sortedContacts.length === 0) {
			Alert.alert('No Contacts', 'No valid contacts found');
			return;
		}

		// Create items for picker
		const items = sortedContacts.map((contact) => ({
			label: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
			value: contact,
		}));

		// Show picker
		Alert.alert(
			'Select Contact',
			'Choose a contact to import:',
			items
				.map((item) => ({
					text: item.label,
					onPress: () => handleContactSelection(item.value),
				}))
				.concat([
					{
						text: 'Cancel',
						style: 'cancel',
					},
				])
		);
	};

	// Handle contact selection
	const handleContactSelection = async (contact) => {
		try {
			console.log('Processing contact:', contact);

			// Get primary phone number
			const phoneNumber = contact.phoneNumbers?.[0]?.number;
			console.log('Phone number:', phoneNumber);

			if (!phoneNumber) {
				Alert.alert('Invalid Contact', 'Selected contact must have a phone number');
				return;
			}

			// Format phone number
			const formattedPhone = formatPhoneNumber(phoneNumber);
			console.log('Formatted phone:', formattedPhone);

			// Check for existing contact
			const existingContact = await checkForExistingContact(formattedPhone);
			if (existingContact) {
				Alert.alert('Duplicate Contact', 'This contact already exists in your list.');
				return;
			}

			const contactData = {
				first_name: contact.firstName || '',
				last_name: contact.lastName || '',
				phone: formattedPhone,
				email: contact.emails?.[0]?.email || '',
				notes: '',
				contact_history: [],
				tags: [],
				photo_url: null,
				frequency: 'weekly',
				created_at: serverTimestamp(),
				last_updated: serverTimestamp(),
				user_id: user.uid,
			};

			console.log('Contact data to add:', contactData);

			// Add contact to Firebase
			const newContact = await addContact(user.uid, contactData);
			console.log('New contact added:', newContact);

			// Refresh contacts list
			await loadContacts();

			// Show contact details modal
			setSelectedContact(newContact);
			setIsDetailsVisible(true);

			Alert.alert('Success', 'Contact imported successfully');
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
			// Add to OnMyList
			await addContact(user.uid, formData);

			// Add to iOS Contacts if on iOS
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

	const handleEditContact = async (formData) => {
		try {
			await updateContact(editingContact.id, formData);

			// Update iOS Contact if on iOS
			if (Platform.OS === 'ios') {
				const { status } = await Contacts.requestPermissionsAsync();
				if (status === 'granted') {
					try {
						// Find existing contact by phone number
						const { data } = await Contacts.getContactsAsync({
							fields: ['phoneNumbers'],
						});

						const existingContact = data.find((contact) =>
							contact.phoneNumbers?.some(
								(phone) => formatPhoneNumber(phone.number) === formatPhoneNumber(formData.phone)
							)
						);

						if (existingContact) {
							const updatedContact = {
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

							await Contacts.updateContactAsync(existingContact);
						}
					} catch (error) {
						console.error('Error updating iOS contact:', error);
					}
				}
			}

			setIsFormVisible(false);
			setEditingContact(null);
			loadContacts();
		} catch (error) {
			console.error('Error updating contact:', error);
			Alert.alert('Error', 'Failed to update contact');
		}
	};

	const handleOpenDetails = (contact) => {
		setSelectedContact(contact);
		setIsDetailsVisible(true);
	};

	const handleStartEdit = (contact) => {
		setEditingContact(contact);
		setIsDetailsVisible(false);
		setIsFormVisible(true);
	};

	if (!user) {
		return (
			<View style={styles.container}>
				<Text style={styles.message}>Please log in to view your contacts</Text>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<StatusBar style="auto" />

			<View style={styles.header}>
				<Image source={Logo} style={styles.logo} resizeMode="contain" />
			</View>

			<View style={styles.buttonContainer}>
				<TouchableOpacity style={styles.importButton} onPress={handleImportContacts}>
					<Icon name="people-outline" size={20} color="#fff" />
					<Text style={styles.importButtonText}>Import from Contacts</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={styles.secondaryButton}
					onPress={() => {
						setEditingContact(null);
						setIsFormVisible(true);
					}}
				>
					<Icon name="add-outline" size={20} color="#007AFF" />
					<Text style={styles.secondaryButtonText}>Add New Contact</Text>
				</TouchableOpacity>
			</View>

			<ScrollView
				style={styles.content}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
			>
				{loading ? (
					<Text style={styles.message}>Loading contacts...</Text>
				) : (
					<>
						{contacts.scheduledContacts.length > 0 && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Scheduled Contacts</Text>
								<View style={styles.grid}>
									{contacts.scheduledContacts.map((contact) => (
										<ContactCard key={contact.id} contact={contact} onPress={handleOpenDetails} />
									))}
								</View>
							</View>
						)}

						{contacts.unscheduledContacts.length > 0 && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Other Contacts</Text>
								<View style={styles.grid}>
									{contacts.unscheduledContacts.map((contact) => (
										<ContactCard key={contact.id} contact={contact} onPress={handleOpenDetails} />
									))}
								</View>
							</View>
						)}

						{contacts.scheduledContacts.length === 0 && contacts.unscheduledContacts.length === 0 && (
							<Text style={styles.message}>No contacts yet</Text>
						)}
					</>
				)}
			</ScrollView>

			<ContactForm
				visible={isFormVisible}
				onClose={() => {
					setIsFormVisible(false);
					setEditingContact(null);
				}}
				onSubmit={editingContact ? handleEditContact : handleAddContact}
				initialData={editingContact}
			/>

			<ContactDetailsModal
				visible={isDetailsVisible}
				contact={selectedContact}
				setSelectedContact={setSelectedContact}
				onClose={() => {
					setIsDetailsVisible(false);
					setSelectedContact(null);
				}}
				onEdit={handleStartEdit}
				onSchedule={() => {
					setIsDetailsVisible(false);
					setIsScheduleModalVisible(true);
				}}
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
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#fff',
		paddingTop: Platform.OS === 'ios' ? 50 : 0,
	},
	header: {
		padding: 20,
		alignItems: 'center',
		borderBottomWidth: 1,
		borderBottomColor: '#eee',
	},
	logo: {
		width: '80%',
		height: 50,
	},
	content: {
		flex: 1,
	},
	section: {
		padding: 15,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: '600',
		marginBottom: 15,
		color: '#333',
	},
	grid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginHorizontal: -cardMargin,
	},
	card: {
		width: cardWidth,
		margin: cardMargin,
		backgroundColor: '#f8f9fa',
		borderRadius: 12,
		padding: 15,
		alignItems: 'center',
		borderWidth: 1,
		borderColor: '#eee',
	},
	cardAvatar: {
		width: 60,
		height: 60,
		borderRadius: 30,
		backgroundColor: '#e8f2ff',
		justifyContent: 'center',
		alignItems: 'center',
		marginBottom: 10,
	},
	avatarImage: {
		width: 60,
		height: 60,
		borderRadius: 30,
	},
	avatarText: {
		fontSize: 24,
		fontWeight: '600',
		color: '#007AFF',
	},
	cardName: {
		fontSize: 16,
		fontWeight: '500',
		textAlign: 'center',
	},
	scheduleBadge: {
		position: 'absolute',
		top: 10,
		right: 10,
		width: 12,
		height: 12,
		borderRadius: 6,
		backgroundColor: '#fff',
		alignItems: 'center',
		justifyContent: 'center',
	},
	scheduleDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: '#4CAF50',
	},
	modalContainer: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		padding: 20,
	},
	modalContent: {
		backgroundColor: 'white',
		borderRadius: 20,
		padding: 20,
		maxHeight: '80%',
	},
	modalHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 20,
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: 'bold',
	},
	modalScroll: {
		maxHeight: '80%',
	},
	contactInfo: {
		marginBottom: 20,
	},
	contactDetail: {
		fontSize: 16,
		marginBottom: 5,
		color: '#666',
	},
	notesSection: {
		marginBottom: 20,
	},
	notesInput: {
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 10,
		padding: 10,
		minHeight: 100,
		textAlignVertical: 'top',
	},
	historySection: {
		marginBottom: 20,
	},
	historyEntry: {
		marginBottom: 10,
		padding: 10,
		backgroundColor: '#f8f9fa',
		borderRadius: 10,
	},
	historyDate: {
		fontSize: 14,
		color: '#666',
		marginBottom: 5,
	},
	historyNotes: {
		fontSize: 16,
	},
	modalActions: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 20,
	},
	modalButton: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 15,
		borderRadius: 10,
		marginHorizontal: 5,
	},
	// History Notes Input
	historyNotesInput: {
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 5,
		padding: 8,
		marginTop: 5,
		backgroundColor: '#f9f9f9',
	},
	// Complete Button for Unscheduled Contacts
	completeButton: {
		backgroundColor: '#007AFF',
		marginTop: 15,
		paddingVertical: 12,
		paddingHorizontal: 20,
		borderRadius: 10,
		alignItems: 'center',
	},
	// Edit Footer Button
	editFooterButton: {
		backgroundColor: '#007AFF',
		flexDirection: 'row',
		padding: 15,
		borderRadius: 10,
	},
	// Schedule Footer Button
	scheduleFooterButton: {
		backgroundColor: '#4CAF50',
		flexDirection: 'row',
		padding: 15,
		borderRadius: 10,
	},
	suggestionsContainer: {
		marginTop: 10,
		padding: 10,
		backgroundColor: '#f9f9f9',
		borderRadius: 8,
	},
	suggestionsTitle: {
		fontSize: 16,
		fontWeight: '600',
		color: '#333',
		marginBottom: 5,
	},
	suggestionsText: {
		fontSize: 14,
		color: '#666',
		textAlign: 'center',
	},
	suggestion: {
		fontSize: 14,
		color: '#333',
		marginBottom: 5,
	},
	callNotesButton: {
		backgroundColor: '#FFA500', // Orange button
		flexDirection: 'row',
		padding: 15,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
		marginHorizontal: 5,
	},
	dateButtonText: {
		fontSize: 16,
		color: '#333',
		fontWeight: '500',
	},
	unscheduledSection: {
		marginTop: 20,
	},
	scheduleButton: {
		backgroundColor: '#4CAF50',
	},
	cancelButton: {
		backgroundColor: '#FF3B30',
	},
	saveButton: {
		backgroundColor: '#007AFF',
	},
	buttonText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '500',
	},
	input: {
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 10,
		padding: 15,
		marginBottom: 15,
		fontSize: 16,
		color: '#333',
		backgroundColor: '#fff',
	},
	message: {
		textAlign: 'center',
		padding: 20,
		color: '#666',
		fontSize: 16,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: '600',
		marginBottom: 15,
		paddingHorizontal: 15,
		color: '#333',
	},
	historyActions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		marginTop: 10,
		gap: 10,
	},
	// Button for Edit/Save
	editButton: {
		backgroundColor: '#007AFF',
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 6,
		minWidth: 60,
		alignItems: 'center',
	},
	editButtonText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '500',
	},
	// Button for Delete
	deleteButton: {
		backgroundColor: '#FF3B30',
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 6,
		minWidth: 60,
		alignItems: 'center',
	},
	// Call Notes Section
	callNotesSection: {
		marginBottom: 20,
		padding: 15,
	},
	callNotesInput: {
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 10,
		padding: 15,
		minHeight: 100,
		marginBottom: 10,
		fontSize: 16,
		color: '#000000',
		backgroundColor: '#ffffff',
		placeholderTextColor: '#666666',
	},
	callNotesControls: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	dateButton: {
		backgroundColor: '#f0f0f0',
		padding: 10,
		borderRadius: 8,
		flex: 1,
		marginRight: 10,
	},
	submitCallButton: {
		backgroundColor: '#4CAF50',
		padding: 10,
		borderRadius: 8,
		width: 100,
		alignItems: 'center',
	},
	// Tags Styles
	tagsContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		padding: 10,
		gap: 8,
	},
	tagBubble: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#e8f2ff',
		borderRadius: 15,
		paddingVertical: 5,
		paddingHorizontal: 10,
	},
	tagText: {
		color: '#007AFF',
		marginRight: 5,
	},
	tagInputContainer: {
		flexDirection: 'row',
		padding: 10,
		gap: 10,
	},
	tagInput: {
		flex: 1,
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 8,
		padding: 10,
	},
	tagButton: {
		backgroundColor: '#007AFF',
		padding: 10,
		borderRadius: 8,
		width: 80,
		alignItems: 'center',
	},
	tagButtonDisabled: {
		backgroundColor: '#ccc',
	},
	doneButton: {
		backgroundColor: '#4CAF50',
		padding: 15,
		borderRadius: 8,
		alignItems: 'center',
		margin: 10,
	},
	tagsButton: {
		backgroundColor: '#007AFF',
	},
	// Date Picker Modal
	datePickerModalOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	datePickerContainer: {
		backgroundColor: 'white',
		padding: 20,
		borderRadius: 10,
		minWidth: 300,
	},
	buttonContainer: {
		padding: 20,
		gap: 10,
	},
	// Import Button
	importButton: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#007AFF',
		paddingVertical: 12,
		paddingHorizontal: 20,
		borderRadius: 10,
		justifyContent: 'center',
	},
	importButtonText: {
		color: '#fff',
		marginLeft: 10,
		fontSize: 16,
		fontWeight: '500',
	},
	secondaryButton: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#f8f9fa',
		paddingVertical: 12,
		paddingHorizontal: 20,
		borderRadius: 10,
		justifyContent: 'center',
		borderWidth: 1,
		borderColor: '#007AFF',
	},
	secondaryButtonText: {
		color: '#007AFF',
		marginLeft: 10,
		fontSize: 16,
		fontWeight: '500',
	},
	// Contacts Search Modal
	searchInput: {
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 10,
		padding: 15,
		marginBottom: 15,
		fontSize: 16,
		backgroundColor: '#fff',
	},
	searchResults: {
		maxHeight: '80%',
	},
	searchResultItem: {
		padding: 15,
		borderBottomWidth: 1,
		borderBottomColor: '#eee',
	},
	searchResultText: {
		fontSize: 16,
		color: '#333',
	},
});
