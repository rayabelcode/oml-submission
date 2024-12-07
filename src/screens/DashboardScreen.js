import React, { useState, useEffect } from 'react';
import {
	StyleSheet,
	Text,
	View,
	ScrollView,
	TouchableOpacity,
	RefreshControl,
	Alert,
	Modal,
	TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import {
	fetchUpcomingContacts,
	fetchPastContacts,
	addContactHistory,
	updateContact,
} from '../utils/firestore';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';

// Sort options
const SORT_OPTIONS = {
	NEXT_CONTACT: 'next_contact',
	LAST_CONTACT: 'last_contact',
	NAME: 'name',
};

// View modes
const VIEW_MODES = {
	UPCOMING: 'upcoming',
	ARCHIVE: 'archive',
};

// Contact Card Component
const ContactCard = ({ contact, onPress }) => (
	<TouchableOpacity style={styles.card} onPress={() => onPress(contact)}>
		<View style={styles.cardHeader}>
			<View style={styles.avatarContainer}>
				{contact.photo_url ? (
					<Image source={{ uri: contact.photo_url }} style={styles.avatar} />
				) : (
					<Icon name="person-outline" size={24} color="#007AFF" />
				)}
			</View>
			<View style={styles.cardInfo}>
				<Text style={styles.cardName}>{contact.name}</Text>
				<Text style={styles.cardDate}>
					Next Contact: {new Date(contact.next_contact).toLocaleDateString()}
				</Text>
			</View>
			<Icon name="time-outline" size={16} color="#666" />
		</View>
	</TouchableOpacity>
);

// Contact Details Modal
const ContactDetailsModal = ({ visible, contact, onClose, onComplete }) => {
	const [notes, setNotes] = useState('');
	const [nextDate, setNextDate] = useState(new Date());
	const [showDatePicker, setShowDatePicker] = useState(false);

	useEffect(() => {
		if (contact) {
			setNextDate(new Date(contact.next_contact));
		}
	}, [contact]);

	const handleComplete = async () => {
		if (!notes.trim()) {
			Alert.alert('Error', 'Please add notes about your contact');
			return;
		}

		try {
			await addContactHistory(contact.id, {
				notes: notes,
				next_contact: nextDate.toISOString(),
			});

			// Update the contact's main notes and dates
			await updateContact(contact.id, {
				notes: notes,
				last_contact: new Date().toISOString(),
				next_contact: nextDate.toISOString(),
			});

			onComplete();
			onClose();
			Alert.alert('Success', 'Contact completed and next contact scheduled');
		} catch (error) {
			console.error('Error completing contact:', error);
			Alert.alert('Error', 'Failed to complete contact');
		}
	};

	if (!contact) return null;

	return (
		<Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
			<View style={styles.modalContainer}>
				<View style={styles.modalContent}>
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>{contact.name}</Text>
						<TouchableOpacity onPress={onClose}>
							<Icon name="close-outline" size={24} color="#666" />
						</TouchableOpacity>
					</View>

					<ScrollView style={styles.modalScroll}>
						<Text style={styles.label}>Contact Notes:</Text>
						<TextInput
							style={styles.notesInput}
							multiline
							value={notes}
							onChangeText={setNotes}
							placeholder="What did you discuss?"
						/>

						<TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
							<Text style={styles.dateButtonText}>Next Contact: {nextDate.toLocaleDateString()}</Text>
						</TouchableOpacity>

						{showDatePicker && Platform.OS !== 'web' ? (
							<DateTimePicker
								value={nextDate}
								mode="date"
								display="default"
								onChange={(event, selectedDate) => {
									setShowDatePicker(false);
									if (selectedDate) {
										setNextDate(selectedDate);
									}
								}}
							/>
						) : showDatePicker ? (
							<input
								type="date"
								value={nextDate.toISOString().split('T')[0]}
								onChange={(e) => {
									setShowDatePicker(false);
									setNextDate(new Date(e.target.value));
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
						) : null}

						<View style={styles.historySection}>
							<Text style={styles.sectionTitle}>Contact History</Text>
							{contact.contact_history?.map((entry, index) => (
								<View key={index} style={styles.historyEntry}>
									<Text style={styles.historyDate}>{new Date(entry.date).toLocaleDateString()}</Text>
									<Text style={styles.historyNotes}>{entry.notes}</Text>
								</View>
							))}
						</View>
					</ScrollView>

					<View style={styles.modalActions}>
						<TouchableOpacity style={[styles.button, styles.completeButton]} onPress={handleComplete}>
							<Text style={styles.buttonText}>Complete & Schedule Next</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</Modal>
	);
};

export default function DashboardScreen({ route }) {
	const { user } = useAuth();
	const [contacts, setContacts] = useState([]);
	const [refreshing, setRefreshing] = useState(false);
	const [loading, setLoading] = useState(true);
	const [viewMode, setViewMode] = useState(VIEW_MODES.UPCOMING);
	const [sortBy, setSortBy] = useState(SORT_OPTIONS.NEXT_CONTACT);
	const [selectedContact, setSelectedContact] = useState(null);
	const [isDetailsVisible, setIsDetailsVisible] = useState(false);

	async function loadContacts() {
		try {
			if (!user) return;
			const loadFunction = viewMode === VIEW_MODES.UPCOMING ? fetchUpcomingContacts : fetchPastContacts;
			const contactsList = await loadFunction(user.uid);

			const sortedContacts = [...contactsList].sort((a, b) => {
				switch (sortBy) {
					case SORT_OPTIONS.NEXT_CONTACT:
						return new Date(a.next_contact) - new Date(b.next_contact);
					case SORT_OPTIONS.LAST_CONTACT:
						return new Date(b.last_contact || 0) - new Date(a.last_contact || 0);
					case SORT_OPTIONS.NAME:
						return a.name.localeCompare(b.name);
					default:
						return 0;
				}
			});

			setContacts(sortedContacts);
		} catch (error) {
			console.error('Error loading contacts:', error);
			Alert.alert('Error', 'Failed to load contacts');
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		if (user) {
			loadContacts();
		}
	}, [user, viewMode, sortBy, route?.params?.refresh]);

	const onRefresh = React.useCallback(async () => {
		setRefreshing(true);
		await loadContacts();
		setRefreshing(false);
	}, [viewMode, sortBy]);

	const handleContactPress = (contact) => {
		setSelectedContact(contact);
		setIsDetailsVisible(true);
	};

	if (!user) {
		return (
			<View style={styles.container}>
				<Text style={styles.message}>Please log in to view your calendar</Text>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<StatusBar style="auto" />

			<View style={styles.header}>
				<Text style={styles.title}>Calendar</Text>
				<Text style={styles.subtitle}>
					{viewMode === VIEW_MODES.UPCOMING ? `${contacts.length} upcoming contacts` : 'Contact History'}
				</Text>
			</View>

			<View style={styles.controls}>
				<View style={styles.viewToggle}>
					<TouchableOpacity
						style={[styles.toggleButton, viewMode === VIEW_MODES.UPCOMING && styles.toggleButtonActive]}
						onPress={() => setViewMode(VIEW_MODES.UPCOMING)}
					>
						<Icon
							name="calendar-outline"
							size={20}
							color={viewMode === VIEW_MODES.UPCOMING ? '#007AFF' : '#666'}
						/>
						<Text style={[styles.toggleText, viewMode === VIEW_MODES.UPCOMING && styles.toggleTextActive]}>
							Upcoming
						</Text>
					</TouchableOpacity>

					<TouchableOpacity
						style={[styles.toggleButton, viewMode === VIEW_MODES.ARCHIVE && styles.toggleButtonActive]}
						onPress={() => setViewMode(VIEW_MODES.ARCHIVE)}
					>
						<Icon name="time-outline" size={20} color={viewMode === VIEW_MODES.ARCHIVE ? '#007AFF' : '#666'} />
						<Text style={[styles.toggleText, viewMode === VIEW_MODES.ARCHIVE && styles.toggleTextActive]}>
							Archive
						</Text>
					</TouchableOpacity>
				</View>

				<View style={styles.sortContainer}>
					<Text style={styles.sortLabel}>Sort by:</Text>
					<Picker
						selectedValue={sortBy}
						style={styles.sortPicker}
						onValueChange={(value) => setSortBy(value)}
					>
						<Picker.Item label="Next Contact" value={SORT_OPTIONS.NEXT_CONTACT} />
						<Picker.Item label="Last Contact" value={SORT_OPTIONS.LAST_CONTACT} />
						<Picker.Item label="Name" value={SORT_OPTIONS.NAME} />
					</Picker>
				</View>
			</View>

			<ScrollView
				style={styles.contactsList}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
			>
				{loading ? (
					<Text style={styles.message}>Loading contacts...</Text>
				) : contacts.length === 0 ? (
					<Text style={styles.message}>
						{viewMode === VIEW_MODES.UPCOMING ? 'No upcoming contacts' : 'No contact history'}
					</Text>
				) : (
					contacts.map((contact) => (
						<ContactCard key={contact.id} contact={contact} onPress={handleContactPress} />
					))
				)}
			</ScrollView>

			<ContactDetailsModal
				visible={isDetailsVisible}
				contact={selectedContact}
				onClose={() => {
					setIsDetailsVisible(false);
					setSelectedContact(null);
				}}
				onComplete={loadContacts}
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
		backgroundColor: '#f8f9fa',
		borderBottomWidth: 1,
		borderBottomColor: '#eee',
	},
	title: {
		fontSize: 24,
		fontWeight: 'bold',
	},
	subtitle: {
		fontSize: 16,
		color: '#666',
		marginTop: 5,
	},
	controls: {
		padding: 15,
		borderBottomWidth: 1,
		borderBottomColor: '#eee',
	},
	viewToggle: {
		flexDirection: 'row',
		justifyContent: 'center',
		marginBottom: 15,
	},
	toggleButton: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 20,
		marginHorizontal: 5,
		backgroundColor: '#f8f9fa',
	},
	toggleButtonActive: {
		backgroundColor: '#e8f2ff',
	},
	toggleText: {
		marginLeft: 8,
		color: '#666',
		fontWeight: '500',
	},
	toggleTextActive: {
		color: '#007AFF',
	},
	sortContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 10,
	},
	sortLabel: {
		fontSize: 16,
		color: '#666',
		marginRight: 10,
	},
	sortPicker: {
		flex: 1,
		height: 40,
	},
	contactsList: {
		flex: 1,
		padding: 15,
	},
	card: {
		backgroundColor: '#f8f9fa',
		padding: 15,
		borderRadius: 10,
		marginBottom: 10,
		borderWidth: 1,
		borderColor: '#eee',
	},
	cardHeader: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	avatarContainer: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: '#e8f2ff',
		justifyContent: 'center',
		alignItems: 'center',
		marginRight: 12,
	},
	avatar: {
		width: 40,
		height: 40,
		borderRadius: 20,
	},
	cardInfo: {
		flex: 1,
	},
	cardName: {
		fontSize: 16,
		fontWeight: '500',
		marginBottom: 4,
	},
	cardDate: {
		fontSize: 14,
		color: '#666',
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
	label: {
		fontSize: 16,
		fontWeight: '500',
		marginBottom: 8,
		color: '#333',
	},
	notesInput: {
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 10,
		padding: 12,
		minHeight: 100,
		marginBottom: 20,
		textAlignVertical: 'top',
	},
	dateButton: {
		backgroundColor: '#f8f9fa',
		padding: 12,
		borderRadius: 10,
		marginBottom: 20,
		alignItems: 'center',
	},
	dateButtonText: {
		fontSize: 16,
		color: '#333',
	},
	historySection: {
		marginTop: 20,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: '600',
		marginBottom: 12,
		color: '#333',
	},
	historyEntry: {
		backgroundColor: '#f8f9fa',
		padding: 12,
		borderRadius: 10,
		marginBottom: 8,
	},
	historyDate: {
		fontSize: 14,
		color: '#666',
		marginBottom: 4,
	},
	historyNotes: {
		fontSize: 16,
		color: '#333',
	},
	modalActions: {
		marginTop: 20,
	},
	button: {
		padding: 15,
		borderRadius: 10,
		alignItems: 'center',
	},
	completeButton: {
		backgroundColor: '#007AFF',
	},
	buttonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '500',
	},
	message: {
		textAlign: 'center',
		padding: 20,
		color: '#666',
		fontSize: 16,
	},
});
