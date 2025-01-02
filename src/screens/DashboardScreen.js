import React, { useState, useEffect } from 'react';
import { Text, View, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useStyles } from '../styles/screens/dashboard';
import { useCommonStyles } from '../styles/common';
import { useTheme } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { fetchUpcomingContacts } from '../utils/firestore';
import { NotificationsView } from '../components/dashboard/NotificationsView';
import { notificationService } from '../utils/notifications';
import ContactCard from '../components/dashboard/ContactCard';
import ContactDetailsModal from '../components/contacts/ContactDetailsModal';
import ActionModal from '../components/general/ActionModal';
import { useFocusEffect } from '@react-navigation/native';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function DashboardScreen({ navigation, route }) {
	const { user } = useAuth();
	const { colors } = useTheme();
	const styles = useStyles();
	const commonStyles = useCommonStyles();
	const [contacts, setContacts] = useState([]);
	const [refreshing, setRefreshing] = useState(false);
	const [loading, setLoading] = useState(true);
	const [viewMode, setViewMode] = useState('calendar');
	const [selectedContact, setSelectedContact] = useState(null);
	const [showContactModal, setShowContactModal] = useState(false);
	const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
	const [selectedReminder, setSelectedReminder] = useState(null);
	const [remindersState, setRemindersState] = useState({
		data: [],
		loading: true,
		error: null,
	});

	// Handle navigation from notifications
	useEffect(() => {
		if (route.params?.initialView === 'notifications') {
			setViewMode('notifications');
			if (route.params?.highlightReminderId) {
			}
		}
	}, [route.params]);

	// Refresh data when screen is focused
	useFocusEffect(
		React.useCallback(() => {
			if (user) {
				loadReminders();
			}
		}, [user])
	);

	const loadReminders = async () => {
		setRemindersState((prev) => ({ ...prev, loading: true, error: null }));
		try {
			const activeReminders = await notificationService.getActiveReminders();
			setRemindersState({
				data: activeReminders,
				loading: false,
				error: null,
			});
		} catch (error) {
			console.error('[DashboardScreen] Error loading reminders:', error);
			setRemindersState({
				data: [],
				loading: false,
				error: 'Failed to load reminders',
			});
			Alert.alert('Error', 'Failed to load reminders');
		}
	};

	const handleFollowUpComplete = async (reminderId, notes) => {
		try {
			if (notes) {
				const reminder = remindersState.data.find((r) => r.firestoreId === reminderId);
				const contactId = reminder.data?.contactId;
				const contact = contacts.find((c) => c.id === contactId);

				if (contact) {
					const currentDate = new Date().toISOString().split('T')[0];
					const newHistoryEntry = {
						completed: true,
						date: currentDate,
						notes: notes,
					};

					const contactRef = doc(db, 'contacts', contact.id);
					await updateDoc(contactRef, {
						contact_history: arrayUnion(newHistoryEntry),
						last_updated: serverTimestamp(),
					});
				}
			}

			// Update local state first
			setRemindersState((prev) => ({
				...prev,
				data: prev.data.filter((r) => r.firestoreId !== reminderId),
			}));

			// Then update backend
			await notificationService.handleFollowUpComplete(reminderId);
			await loadContacts(); // Only reload contacts if needed
		} catch (error) {
			console.error('Error completing follow-up:', error);
			Alert.alert('Error', 'Failed to complete follow-up');
			// Reload everything if there's an error
			await loadReminders();
		}
	};

	const handleAddNotes = (reminder) => {
		const contact = contacts.find((c) => c.id === reminder.data?.contactId);
		if (contact) {
			setSelectedContact(contact);
			setShowContactModal(true);
		} else {
			console.error('Contact not found for reminder:', reminder);
			Alert.alert('Error', 'Could not find contact information');
		}
	};

	const handleSnooze = (reminder) => {
		setSelectedReminder(reminder);
		setShowSnoozeOptions(true);
	};

	const handleSnoozeSelection = async (duration) => {
		if (!selectedReminder) return;

		try {
			const newTime = new Date(Date.now() + duration);
			await notificationService.rescheduleFollowUp(selectedReminder.firestoreId, newTime);
			await loadReminders();
		} catch (error) {
			console.error('Error snoozing reminder:', error);
			Alert.alert('Error', 'Failed to snooze reminder');
		} finally {
			setShowSnoozeOptions(false);
			setSelectedReminder(null);
		}
	};

	async function loadContacts() {
		try {
			if (!user) return;
			const contactsList = await fetchUpcomingContacts(user.uid);
			setContacts(contactsList.sort((a, b) => new Date(a.next_contact) - new Date(b.next_contact)));
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
			loadReminders();
		}
	}, [user]);

	const onRefresh = React.useCallback(async () => {
		setRefreshing(true);
		try {
			await Promise.all([loadContacts(), loadReminders()]);
		} catch (error) {
			console.error('Error refreshing data:', error);
			Alert.alert('Error', 'Failed to refresh data');
		} finally {
			setRefreshing(false);
		}
	}, []);

	if (!user) {
		return (
			<View style={commonStyles.container}>
				<Text style={commonStyles.message}>Please log in to view your dashboard</Text>
			</View>
		);
	}

	return (
		<View style={commonStyles.container}>
			<StatusBar style="auto" />

			<View style={styles.buttonContainer}>
				<TouchableOpacity
					style={[commonStyles.toggleButton, viewMode === 'calendar' && styles.toggleButtonActive]}
					onPress={() => setViewMode('calendar')}
				>
					<Icon name="calendar-clear-outline" size={24} color={colors.primary} />
					<Text style={styles.toggleButtonText}>Upcoming</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={[commonStyles.toggleButton, viewMode === 'notifications' && styles.toggleButtonActive]}
					onPress={() => setViewMode('notifications')}
				>
					<Icon name="notifications-outline" size={24} color={colors.primary} />
					<Text style={styles.toggleButtonText}>Notifications</Text>
				</TouchableOpacity>
			</View>

			{viewMode === 'calendar' ? (
				<ScrollView
					style={styles.contactsList}
					refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
				>
					{loading ? (
						<Text style={commonStyles.message}>Loading contacts...</Text>
					) : contacts.length === 0 ? (
						<Text style={commonStyles.message}>No upcoming contacts</Text>
					) : (
						contacts.map((contact) => (
							<ContactCard
								key={contact.id}
								contact={contact}
								onPress={() => {
									setSelectedContact(contact);
									setShowContactModal(true);
								}}
							/>
						))
					)}
				</ScrollView>
			) : (
				<NotificationsView
					reminders={remindersState.data}
					onComplete={handleFollowUpComplete}
					onAddNotes={handleAddNotes}
					onSnooze={handleSnooze}
					loading={remindersState.loading}
					onRefresh={onRefresh}
					refreshing={refreshing}
				/>
			)}

			<ContactDetailsModal
				visible={showContactModal}
				contact={selectedContact}
				setSelectedContact={setSelectedContact}
				onClose={() => setShowContactModal(false)}
				loadContacts={loadContacts}
				initialTab="notes"
			/>

			<ActionModal
				show={showSnoozeOptions}
				onClose={() => {
					setShowSnoozeOptions(false);
					setSelectedReminder(null);
				}}
				options={[
					{
						id: '1h',
						icon: 'time-outline',
						text: 'In 1 hour',
						onPress: () => handleSnoozeSelection(60 * 60 * 1000),
					},
					{
						id: '3h',
						icon: 'time-outline',
						text: 'In 3 hours',
						onPress: () => handleSnoozeSelection(3 * 60 * 60 * 1000),
					},
					{
						id: '1d',
						icon: 'calendar-outline',
						text: 'Tomorrow',
						onPress: () => handleSnoozeSelection(24 * 60 * 60 * 1000),
					},
				]}
			/>
		</View>
	);
}
