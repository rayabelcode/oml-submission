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
import { Bell, Plus } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import {
	fetchReminders,
	completeReminder,
	addReminder,
	fetchContacts,
	updateReminder,
} from '../utils/firestore';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

// Modal component
const ReminderModal = ({
	visible,
	onClose,
	onSubmit,
	contacts,
	reminderData,
	setReminderData,
	showDatePicker,
	setShowDatePicker,
	isEditing,
}) => (
	<Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
		<View style={styles.modalContainer}>
			<View style={styles.modalContent}>
				<Text style={styles.modalTitle}>{isEditing ? 'Edit Reminder' : 'Add New Reminder'}</Text>

				<TextInput
					style={styles.input}
					placeholder="Reminder Title"
					value={reminderData.title}
					onChangeText={(text) => setReminderData({ ...reminderData, title: text })}
				/>

				<TextInput
					style={[styles.input, { height: 100 }]}
					placeholder="Description"
					multiline
					value={reminderData.description}
					onChangeText={(text) => setReminderData({ ...reminderData, description: text })}
				/>

				<Text style={styles.label}>Select Contact:</Text>
				<Picker
					selectedValue={reminderData.contact_id}
					style={styles.picker}
					onValueChange={(value) => setReminderData({ ...reminderData, contact_id: value })}
				>
					<Picker.Item label="Select a contact" value="" />
					{contacts.map((contact) => (
						<Picker.Item key={contact.id} label={contact.name} value={contact.id} />
					))}
				</Picker>

				<Text style={styles.label}>Reminder Type:</Text>
				<Picker
					selectedValue={reminderData.reminder_type}
					style={styles.picker}
					onValueChange={(value) => setReminderData({ ...reminderData, reminder_type: value })}
				>
					<Picker.Item label="Call" value="call" />
					<Picker.Item label="Message" value="message" />
					<Picker.Item label="Email" value="email" />
					<Picker.Item label="Meet" value="meet" />
				</Picker>

				<TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
					<Text>Select Due Date: {reminderData.due_date.toLocaleDateString()}</Text>
				</TouchableOpacity>

				{showDatePicker && (
					<DateTimePicker
						value={reminderData.due_date}
						mode="datetime"
						display="default"
						onChange={(event, selectedDate) => {
							setShowDatePicker(false);
							if (selectedDate) {
								setReminderData({ ...reminderData, due_date: selectedDate });
							}
						}}
					/>
				)}

				<View style={styles.buttonContainer}>
					<TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
						<Text style={styles.buttonText}>Cancel</Text>
					</TouchableOpacity>

					<TouchableOpacity style={[styles.button, styles.saveButton]} onPress={onSubmit}>
						<Text style={styles.buttonText}>{isEditing ? 'Save Changes' : 'Add Reminder'}</Text>
					</TouchableOpacity>
				</View>
			</View>
		</View>
	</Modal>
);

// ReminderCard component
const ReminderCard = ({ id, title, description, due_date, contact, reminder_type, onComplete, onEdit }) => (
	<View style={styles.card}>
		<View style={styles.cardHeader}>
			<Bell size={20} color="#007AFF" />
			<Text style={styles.cardTitle}>{title}</Text>
		</View>
		{description && (
			<Text style={styles.cardDescription} numberOfLines={2}>
				{description}
			</Text>
		)}
		<Text style={styles.cardDate}>Due: {new Date(due_date).toLocaleDateString()}</Text>
		{contact?.name && <Text style={styles.cardContact}>Contact: {contact.name}</Text>}
		{reminder_type && (
			<View style={styles.tagContainer}>
				<Text style={styles.tag}>{reminder_type}</Text>
			</View>
		)}
		<View style={styles.cardActions}>
			<TouchableOpacity style={styles.cardButton} onPress={() => onEdit(id)}>
				<Text style={styles.cardButtonText}>Edit</Text>
			</TouchableOpacity>
			<TouchableOpacity style={styles.cardButton} onPress={() => onComplete(id)}>
				<Text style={styles.cardButtonText}>Complete</Text>
			</TouchableOpacity>
		</View>
	</View>
);

// Main component
export default function DashboardScreen() {
	const { user } = useAuth();
	const [reminders, setReminders] = useState([]);
	const [refreshing, setRefreshing] = useState(false);
	const [loading, setLoading] = useState(true);
	const [isAddModalVisible, setIsAddModalVisible] = useState(false);
	const [contacts, setContacts] = useState([]);
	const [newReminder, setNewReminder] = useState({
		title: '',
		description: '',
		contact_id: '',
		reminder_type: 'call',
		due_date: new Date(),
	});
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [editingReminderId, setEditingReminderId] = useState(null);
	const [isEditing, setIsEditing] = useState(false);

	async function loadReminders() {
		try {
			if (!user) return;
			const remindersList = await fetchReminders(user.uid);
			setReminders(remindersList);
		} catch (error) {
			console.error('Error fetching reminders:', error.message);
			Alert.alert('Error', 'Failed to load reminders');
		} finally {
			setLoading(false);
		}
	}

	async function loadContacts() {
		try {
			if (!user) return;
			const contactsList = await fetchContacts(user.uid);
			setContacts(contactsList);
		} catch (error) {
			console.error('Error fetching contacts:', error.message);
		}
	}

	useEffect(() => {
		if (user) {
			loadReminders();
			loadContacts();
		}
	}, [user]);

	const onRefresh = React.useCallback(async () => {
		setRefreshing(true);
		await loadReminders();
		setRefreshing(false);
	}, []);

	async function handleCompleteReminder(reminderId) {
		try {
			await completeReminder(reminderId);
			loadReminders();
			Alert.alert('Success', 'Reminder marked as completed');
		} catch (error) {
			console.error('Error completing reminder:', error.message);
			Alert.alert('Error', 'Failed to complete reminder');
		}
	}

	const handleEditReminder = (reminderId) => {
		const reminderToEdit = reminders.find((rem) => rem.id === reminderId);
		if (reminderToEdit) {
			setNewReminder({
				title: reminderToEdit.title,
				description: reminderToEdit.description,
				contact_id: reminderToEdit.contact?.id || '',
				reminder_type: reminderToEdit.reminder_type,
				due_date: new Date(reminderToEdit.due_date),
			});
			setEditingReminderId(reminderId);
			setIsEditing(true);
			setIsAddModalVisible(true);
		}
	};

	const handleCloseModal = () => {
		setIsAddModalVisible(false);
		setIsEditing(false);
		setEditingReminderId(null);
		setNewReminder({
			title: '',
			description: '',
			contact_id: '',
			reminder_type: 'call',
			due_date: new Date(),
		});
	};

	const handleAddReminder = async () => {
		if (!newReminder.title.trim()) {
			Alert.alert('Error', 'Please enter a title for the reminder');
			return;
		}

		try {
			if (isEditing) {
				await updateReminder(editingReminderId, newReminder);
				Alert.alert('Success', 'Reminder updated successfully');
			} else {
				await addReminder(user.uid, newReminder);
				Alert.alert('Success', 'Reminder added successfully');
			}

			setIsAddModalVisible(false);
			loadReminders();
			// Reset form
			setNewReminder({
				title: '',
				description: '',
				contact_id: '',
				reminder_type: 'call',
				due_date: new Date(),
			});
			setIsEditing(false);
			setEditingReminderId(null);
		} catch (error) {
			console.error('Error with reminder:', error);
			Alert.alert('Error', isEditing ? 'Failed to update reminder' : 'Failed to add reminder');
		}
	};

	if (!user) {
		return (
			<View style={styles.container}>
				<Text style={styles.message}>Please log in to view your reminders</Text>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<StatusBar style="auto" />

			<ReminderModal
				visible={isAddModalVisible}
				onClose={handleCloseModal}
				onSubmit={handleAddReminder}
				contacts={contacts}
				reminderData={newReminder}
				setReminderData={setNewReminder}
				showDatePicker={showDatePicker}
				setShowDatePicker={setShowDatePicker}
				isEditing={isEditing}
			/>

			<View style={styles.header}>
				<Text style={styles.title}>Welcome Back!</Text>
				<Text style={styles.subtitle}>You have {reminders.length} upcoming reminders</Text>
			</View>

			<View style={styles.quickActions}>
				<TouchableOpacity style={styles.actionButton} onPress={() => setIsAddModalVisible(true)}>
					<Plus size={24} color="#007AFF" />
					<Text style={styles.actionText}>New Reminder</Text>
				</TouchableOpacity>
			</View>

			<ScrollView
				style={styles.remindersList}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
			>
				{loading ? (
					<Text style={styles.message}>Loading reminders...</Text>
				) : reminders.length === 0 ? (
					<View style={styles.emptyState}>
						<Text style={styles.message}>No upcoming reminders</Text>
						<TouchableOpacity style={styles.addButton} onPress={() => setIsAddModalVisible(true)}>
							<Plus size={20} color="#007AFF" />
							<Text style={styles.addButtonText}>Add Reminder</Text>
						</TouchableOpacity>
					</View>
				) : (
					reminders.map((reminder) => (
						<ReminderCard
							key={reminder.id}
							{...reminder}
							onComplete={handleCompleteReminder}
							onEdit={handleEditReminder}
						/>
					))
				)}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	// Styles
	container: {
		flex: 1,
		backgroundColor: '#fff',
	},
	header: {
		padding: 20,
		backgroundColor: '#f8f9fa',
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
	quickActions: {
		flexDirection: 'row',
		padding: 15,
		justifyContent: 'space-around',
		borderBottomWidth: 1,
		borderBottomColor: '#eee',
	},
	actionButton: {
		alignItems: 'center',
		padding: 10,
	},
	actionText: {
		marginTop: 5,
		color: '#007AFF',
	},
	remindersList: {
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
		marginBottom: 5,
	},
	cardTitle: {
		fontSize: 16,
		fontWeight: '500',
		marginLeft: 10,
		flex: 1,
	},
	cardDescription: {
		color: '#666',
		marginLeft: 30,
		marginBottom: 5,
	},
	cardDate: {
		color: '#666',
		marginLeft: 30,
	},
	cardContact: {
		color: '#666',
		marginLeft: 30,
		marginTop: 5,
	},
	message: {
		textAlign: 'center',
		padding: 20,
		color: '#666',
	},
	emptyState: {
		alignItems: 'center',
		padding: 20,
	},
	addButton: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#fff',
		padding: 10,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#007AFF',
		marginTop: 10,
	},
	addButtonText: {
		color: '#007AFF',
		marginLeft: 5,
	},

	// New styles for modal
	modalContainer: {
		flex: 1,
		justifyContent: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		padding: 20,
	},
	modalContent: {
		backgroundColor: 'white',
		borderRadius: 20,
		padding: 20,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 5,
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		marginBottom: 20,
		textAlign: 'center',
	},
	input: {
		borderWidth: 1,
		borderColor: '#ddd',
		padding: 10,
		borderRadius: 10,
		marginBottom: 15,
	},
	label: {
		fontSize: 16,
		marginBottom: 5,
		color: '#666',
	},
	picker: {
		marginBottom: 15,
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 10,
	},
	dateButton: {
		padding: 10,
		backgroundColor: '#f8f9fa',
		borderRadius: 10,
		marginBottom: 15,
		alignItems: 'center',
	},
	buttonContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	button: {
		flex: 1,
		padding: 15,
		borderRadius: 10,
		marginHorizontal: 5,
		alignItems: 'center',
	},
	cancelButton: {
		backgroundColor: '#FF3B30',
	},
	saveButton: {
		backgroundColor: '#007AFF',
	},
	buttonText: {
		color: 'white',
		fontWeight: '500',
	},
	tagContainer: {
		marginLeft: 30,
		marginTop: 5,
	},
	cardActions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		marginTop: 10,
		paddingTop: 10,
		borderTopWidth: 1,
		borderTopColor: '#eee',
	},
	cardButton: {
		backgroundColor: '#007AFF',
		paddingVertical: 6,
		paddingHorizontal: 12,
		borderRadius: 6,
		marginLeft: 10,
	},
	cardButtonText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '500',
	},
	tag: {
		color: '#007AFF',
		fontSize: 12,
		backgroundColor: '#e8f2ff',
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12,
		alignSelf: 'flex-start',
	},
});
