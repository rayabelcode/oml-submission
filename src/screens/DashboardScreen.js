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
import ActionModal from '../components/general/ActionModal';
import { useFocusEffect } from '@react-navigation/native';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { cacheManager } from '../utils/cache';
import { snoozeHandler, initializeSnoozeHandler } from '../utils/snoozeHandler';
import { DateTime } from 'luxon';

export default function DashboardScreen({ navigation, route }) {
	const { user } = useAuth();
	const { colors } = useTheme();
	const styles = useStyles();
	const commonStyles = useCommonStyles();
	const [contacts, setContacts] = useState([]);
	const [refreshing, setRefreshing] = useState(false);
	const [loading, setLoading] = useState(true);
	const [viewMode, setViewMode] = useState('calendar');
	const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
	const [snoozeLoading, setSnoozeLoading] = useState(false);
	const [snoozeError, setSnoozeError] = useState(null);
	const [selectedReminder, setSelectedReminder] = useState(null);
	const [remindersState, setRemindersState] = useState({
		data: [],
		loading: true,
		error: null,
	});

	const VIEW_MODES = {
		UPCOMING: 'upcoming',
		REMINDERS: 'reminders',
	};

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
			navigation.navigate('ContactDetails', { contact });
		} else {
			console.error('Contact not found for reminder:', reminder);
			Alert.alert('Error', 'Could not find contact information');
		}
	};

	const handleSnooze = (reminder) => {
		if (!reminder?.scheduledTime) {
			console.error('Invalid reminder data:', reminder);
			Alert.alert('Error', 'Unable to snooze reminder');
			return;
		}

		setSelectedReminder(reminder);
		setShowSnoozeOptions(true);
	};

	const handleSnoozeSelection = async (option) => {
		if (!selectedReminder) return;

		setSnoozeLoading(true);
		setSnoozeError(null);

		try {
			// Initialize snoozeHandler with current user ID
			await initializeSnoozeHandler(user.uid);

			const contactId = selectedReminder.data.contactId;
			const currentTime = DateTime.now();

			await snoozeHandler.handleSnooze(contactId, option, currentTime);
			await loadReminders();
			setShowSnoozeOptions(false);
		} catch (error) {
			console.error('Error snoozing reminder:', error);
			setSnoozeError(error.message || 'Unable to snooze reminder. Please try again.');
		} finally {
			setSnoozeLoading(false);
		}
	};

	async function loadContacts() {
		try {
			if (!user) return;

			// Try to get cached data first
			const cachedContacts = await cacheManager.getCachedUpcomingContacts(user.uid);
			if (cachedContacts) {
				setContacts(cachedContacts.sort((a, b) => new Date(a.next_contact) - new Date(b.next_contact)));
				setLoading(false);
			}

			// Then fetch fresh data
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
					style={[commonStyles.toggleButton, viewMode === VIEW_MODES.UPCOMING && styles.toggleButtonActive]}
					onPress={() => setViewMode(VIEW_MODES.UPCOMING)}
				>
					<Icon name="calendar-clear-outline" size={24} color={colors.primary} />
					<Text style={styles.toggleButtonText}>Upcoming Calls</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={[commonStyles.toggleButton, viewMode === VIEW_MODES.REMINDERS && styles.toggleButtonActive]}
					onPress={() => setViewMode(VIEW_MODES.REMINDERS)}
				>
					<Icon name="notifications-outline" size={24} color={colors.primary} />
					<Text style={styles.toggleButtonText}>Call Reminders</Text>
				</TouchableOpacity>
			</View>

			{viewMode === VIEW_MODES.UPCOMING ? (
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
								onPress={(contact) =>
									navigation.navigate('ContactDetails', {
										contact,
										initialTab: 'Schedule',
									})
								}
							/>
						))
					)}
				</ScrollView>
			) : (
				<NotificationsView
					reminders={remindersState.data}
					onComplete={handleFollowUpComplete}
					loading={remindersState.loading}
					onRefresh={onRefresh}
					refreshing={refreshing}
					onSnooze={handleSnooze}
				/>
			)}

			<ActionModal
				show={showSnoozeOptions}
				onClose={() => {
					setShowSnoozeOptions(false);
					setSelectedReminder(null);
					setSnoozeError(null);
				}}
				loading={snoozeLoading}
				error={snoozeError}
				options={[
					{
						id: 'later_today',
						icon: 'time-outline',
						text: 'Later Today',
						onPress: () => handleSnoozeSelection('later_today'),
					},
					{
						id: 'tomorrow',
						icon: 'calendar-outline',
						text: 'Tomorrow',
						onPress: () => handleSnoozeSelection('tomorrow'),
					},
					{
						id: 'next_week',
						icon: 'calendar-outline',
						text: 'Next Week',
						onPress: () => handleSnoozeSelection('next_week'),
					},
					{
						id: 'skip',
						icon: 'close-circle-outline',
						text: 'Skip This Call',
						onPress: () => handleSnoozeSelection('skip'),
					},
				]}
			/>
		</View>
	);
}
