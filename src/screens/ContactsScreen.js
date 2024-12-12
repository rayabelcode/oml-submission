import React, { useState, useEffect, useRef } from 'react';
import { Modal, Image, Dimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
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
						{Platform.OS === 'web' ? (
							<input
								type="datetime-local"
								onChange={(e) => {
									setSelectedDate(new Date(e.target.value));
								}}
								style={{
									padding: 10,
									marginBottom: 15,
									borderRadius: 10,
									borderWidth: 1,
									borderColor: '#ddd',
									width: '100%',
								}}
							/>
						) : (
							<>
								<TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(true)}>
									<Text style={styles.dateButtonText}>
										{selectedDate.toLocaleDateString()} {selectedDate.toLocaleTimeString()}
									</Text>
								</TouchableOpacity>
								{showPicker && (
									<DateTimePicker
										value={selectedDate}
										mode="datetime"
										is24Hour={true}
										display="spinner"
										onChange={(event, date) => {
											setShowPicker(false);
											if (date) {
												setSelectedDate(date);
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
	const getInitials = (name) => {
		return name
			.split(' ')
			.map((word) => word[0])
			.join('')
			.toUpperCase();
	};

	return (
		<TouchableOpacity style={styles.card} onPress={() => onPress(contact)}>
			<View style={styles.cardAvatar}>
				{contact.photo_url ? (
					<Image source={{ uri: contact.photo_url }} style={styles.avatarImage} />
				) : (
					<Text style={styles.avatarText}>{getInitials(contact.name)}</Text>
				)}
			</View>
			<Text style={styles.cardName} numberOfLines={1}>
				{contact.name}
			</Text>
			{contact.next_contact && (
				<View style={styles.scheduleBadge}>
					<View style={styles.scheduleDot} />
				</View>
			)}
		</TouchableOpacity>
	);
};

const ContactDetailsModal = ({ visible, contact, setSelectedContact, onClose, onEdit, onSchedule }) => {
	const [history, setHistory] = useState([]);
	const [notes, setNotes] = useState('');
	const [editMode, setEditMode] = useState(null); // Track editing state
	const [isCallNotesModalVisible, setIsCallNotesModalVisible] = useState(false); // Call Notes modal state
	const [callNotes, setCallNotes] = useState(''); // Call notes text
	const [callDate, setCallDate] = useState(new Date()); // Call date
	const [suggestions, setSuggestions] = useState([]); // Holds AI-generated topic suggestions
	const [loadingSuggestions, setLoadingSuggestions] = useState(false); // Tracks loading state for suggestions
	const [suggestionCache, setSuggestionCache] = useState({});

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

		setIsCallNotesModalVisible(false); // Close modal first

		try {
			// Add new call history to Firestore
			await addContactHistory(contact.id, {
				notes,
				date: date.toISOString(),
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
					{/* Header */}
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>{contact?.name || 'Unknown'}</Text>
						<TouchableOpacity onPress={onClose}>
							<Icon name="close-outline" size={24} color="#666" />
						</TouchableOpacity>
					</View>

					{/* Contact Information */}
					<ScrollView style={styles.modalScroll}>
						<View style={styles.contactInfo}>
							{contact.email && <Text style={styles.contactDetail}>Email: {contact.email}</Text>}
							{contact.phone && <Text style={styles.contactDetail}>Phone: {contact.phone}</Text>}
							{contact.next_contact && (
								<Text style={styles.contactDetail}>
									Next Contact: {new Date(contact.next_contact).toLocaleDateString()}
								</Text>
							)}
						</View>

						{/* Contact Notes Section */}
						<View style={styles.notesSection}>
							<Text style={styles.sectionTitle}>Contact Notes</Text>
							<TextInput
								style={styles.notesInput}
								multiline
								value={notes}
								onChangeText={setNotes}
								placeholder="Add notes about this contact..."
							/>

							{/* Suggested Topics Section */}
							{loadingSuggestions ? (
								<Text style={styles.suggestionsText}>Loading suggestions...</Text>
							) : (
								<View style={styles.suggestionsContainer}>
									<Text style={styles.suggestionsTitle}>Suggested Topics:</Text>
									{suggestions.map((topic, index) => (
										<Text key={index} style={styles.suggestion}>
											- {topic}
										</Text>
									))}
								</View>
							)}
						</View>

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
							style={[styles.modalButton, styles.editFooterButton]}
							onPress={() => onEdit(contact)}
						>
							<Icon name="create-outline" size={20} color="#fff" />
							<Text style={styles.buttonText}>Edit</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[styles.modalButton, styles.callNotesButton]}
							onPress={() => setIsCallNotesModalVisible(true)}
						>
							<Text style={styles.buttonText}>Call Notes</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[styles.modalButton, styles.scheduleFooterButton]}
							onPress={() => onSchedule(contact)}
						>
							<Icon name="time-outline" size={20} color="#fff" />
							<Text style={styles.buttonText}>Schedule</Text>
						</TouchableOpacity>
					</View>

					{/* Call Notes Modal */}
					<CallNotesModal
						visible={isCallNotesModalVisible}
						onClose={() => {
							setIsCallNotesModalVisible(false);
							setCallNotes(''); // Clear call notes
							setCallDate(new Date()); // Reset date
						}}
						onSubmit={handleAddCallNotes}
						callNotes={callNotes} // Pass down call notes
						setCallNotes={setCallNotes}
						callDate={callDate} // Pass down call date
						setCallDate={setCallDate}
					/>
				</View>
			</View>
		</Modal>
	);
};

const CallNotesModal = ({ visible, onClose, onSubmit, callNotes, setCallNotes, callDate, setCallDate }) => {
	const [showDatePicker, setShowDatePicker] = useState(false);

	return (
		<Modal visible={visible} transparent={true} animationType="slide">
			<View style={styles.modalContainer}>
				<View style={styles.modalContent}>
					{/* Modal Header */}
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>Add Call Notes</Text>
						<TouchableOpacity onPress={onClose}>
							<Icon name="close-outline" size={24} color="#666" />
						</TouchableOpacity>
					</View>

					{/* Notes Input */}
					<TextInput
						style={styles.notesInput}
						value={callNotes}
						onChangeText={setCallNotes}
						placeholder="What did you discuss?"
						multiline
					/>

					{/* Date Picker */}
					<TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
						<Text style={styles.dateButtonText}>Call Date: {callDate.toLocaleDateString()}</Text>
					</TouchableOpacity>

					{showDatePicker && (
						<DateTimePicker
							value={callDate}
							mode="date"
							display="default"
							onChange={(event, date) => {
								setShowDatePicker(false);
								if (date) setCallDate(date);
							}}
						/>
					)}

					{/* Confirmation and Cancel Buttons */}
					<View style={styles.modalActions}>
						<TouchableOpacity
							style={[styles.modalButton, styles.saveButton]}
							onPress={() => onSubmit(callNotes, callDate)}
						>
							<Text style={styles.buttonText}>Confirm</Text>
						</TouchableOpacity>
						<TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onClose}>
							<Text style={styles.buttonText}>Cancel</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</Modal>
	);
};

// Add/Edit Contact Modal
const ContactForm = ({ visible, onClose, onSubmit, initialData = null }) => {
	const [formData, setFormData] = useState({
		name: '',
		email: '',
		phone: '',
		frequency: 'weekly',
		notes: '',
	});

	useEffect(() => {
		if (initialData) {
			setFormData({
				name: initialData.name || '',
				email: initialData.email || '',
				phone: initialData.phone || '',
				frequency: initialData.frequency || 'weekly',
				notes: initialData.notes || '',
			});
		} else {
			setFormData({
				name: '',
				email: '',
				phone: '',
				frequency: 'weekly',
				notes: '',
			});
		}
	}, [initialData]);

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
							placeholder="Name"
							value={formData.name}
							onChangeText={(text) => setFormData({ ...formData, name: text })}
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

						<TextInput
							style={[styles.input, styles.notesInput]}
							placeholder="Notes"
							value={formData.notes}
							onChangeText={(text) => setFormData({ ...formData, notes: text })}
							multiline
						/>
					</ScrollView>

					<View style={styles.modalActions}>
						<TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onClose}>
							<Text style={styles.buttonText}>Cancel</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.modalButton, styles.saveButton]}
							onPress={() => onSubmit(formData)}
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
			setIsFormVisible(false);
			loadContacts();
		} catch (error) {
			Alert.alert('Error', 'Failed to add contact');
		}
	};

	const handleEditContact = async (formData) => {
		try {
			await updateContact(editingContact.id, formData);
			setIsFormVisible(false);
			setEditingContact(null);
			loadContacts();
		} catch (error) {
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

			<TouchableOpacity style={styles.addButton} onPress={() => setIsFormVisible(true)}>
				<Icon name="add-outline" size={20} color="#fff" />
				<Text style={styles.addButtonText}>Add New Contact</Text>
			</TouchableOpacity>

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
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#fff',
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
	addButton: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#007AFF',
		paddingVertical: 12,
		paddingHorizontal: 20,
		borderRadius: 10,
		marginVertical: 15,
		marginHorizontal: 20,
		justifyContent: 'center',
	},
	addButtonText: {
		color: '#fff',
		marginLeft: 10,
		fontSize: 16,
		fontWeight: '500',
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
		fontSize: 16,
		fontWeight: '500',
		marginLeft: 5,
	},
	input: {
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 10,
		padding: 15,
		marginBottom: 15,
		fontSize: 16,
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
		padding: 10,
		borderRadius: 5,
		minWidth: 80,
		alignItems: 'center',
		justifyContent: 'center',
		height: 40,
	},
	editButtonText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '500',
	},
	// Button for Delete
	deleteButton: {
		backgroundColor: '#FF3B30',
		padding: 10,
		borderRadius: 5,
		minWidth: 80,
		alignItems: 'center',
		justifyContent: 'center',
		height: 40,
	},
});
