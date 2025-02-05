import React, { useState, useEffect } from 'react';
import { Text, View, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useStyles } from '../styles/screens/dashboard';
import { useCommonStyles } from '../styles/common';
import { useTheme } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { Image as ExpoImage } from 'expo-image';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchUpcomingContacts } from '../utils/firestore';
import { NotificationsView } from '../components/dashboard/NotificationsView';
import { notificationService } from '../utils/notifications';
import ContactCard from '../components/dashboard/ContactCard';
import ActionModal from '../components/general/ActionModal';
import { useFocusEffect } from '@react-navigation/native';
import {
	doc,
	updateDoc,
	arrayUnion,
	serverTimestamp,
	collection,
	query,
	where,
	getDocs,
} from 'firebase/firestore';
import { REMINDER_TYPES } from '../../constants/notificationConstants';
import { db } from '../config/firebase';
import { cacheManager } from '../utils/cache';
import { snoozeHandler, initializeSnoozeHandler } from '../utils/scheduler/snoozeHandler';
import { DateTime } from 'luxon';
import { notificationCoordinator } from '../utils/notificationCoordinator';
import * as Notifications from 'expo-notifications';

export default function DashboardScreen({ navigation, route }) {
	const { user } = useAuth();
	const { colors } = useTheme();
	const styles = useStyles();
	const commonStyles = useCommonStyles();
	const [contacts, setContacts] = useState([]);
	const [refreshing, setRefreshing] = useState(false);
	const [loading, setLoading] = useState(true);
	const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
	const [snoozeOptions, setSnoozeOptions] = useState([]);
	const [snoozeLoading, setSnoozeLoading] = useState(false);
	const [snoozeError, setSnoozeError] = useState(null);
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
				loadContacts();
				loadReminders();
			}
		}, [user])
	);

	// Function to show reminders
	const loadReminders = async () => {
		try {
			// Get Firestore reminders that are either pending or sent
			const remindersRef = collection(db, 'reminders');
			const remindersQuery = query(
				remindersRef,
				where('user_id', '==', user.uid),
				where('status', 'in', ['pending', 'sent'])
			);
			const remindersSnapshot = await getDocs(remindersQuery);
			const allReminders = remindersSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}));

			// Only get scheduled (not yet delivered) notifications
			const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();

			const processReminder = (notification) => {
				const content = notification.content || notification.request?.content;
				const data = content?.data || {};

				let callTime;
				if (data.callData?.startTime) {
					callTime = new Date(data.callData.startTime);
				} else if (data.callData?.callTime) {
					callTime = new Date(data.callData.callTime);
				} else if (data.startTime) {
					callTime = new Date(data.startTime);
				}

				if (!callTime || isNaN(callTime.getTime())) {
					if (data.scheduledTime) {
						callTime = new Date(data.scheduledTime);
					} else if (notification.trigger) {
						callTime = new Date(notification.trigger.timestamp || notification.trigger.date);
					} else {
						callTime = new Date(0);
					}
				}

				return {
					type: 'FOLLOW_UP',
					firestoreId: data.firestoreId || notification.identifier || notification.request?.identifier,
					scheduledTime: callTime,
					data: {
						...data,
						contactName: data.contactName,
						callTime: callTime.toISOString(),
					},
					status: 'pending',
					contactName: data.contactName || 'Unknown Contact',
				};
			};

			// Process scheduled follow-up notifications only
			const followUpReminders = scheduledNotifications
				.filter((notification) => notification.content?.data?.type === 'FOLLOW_UP')
				.map(processReminder);

			const now = DateTime.now();

			// Filter Firestore reminders to include sent reminders and due pending reminders
			const filteredFirestoreReminders = allReminders.filter((reminder) => {
				// Always include sent reminders
				if (reminder.status === 'sent') return true;

				// For pending reminders, check if they're due
				if (reminder.frequency === 'daily') return false;
				let scheduledTime;
				try {
					if (reminder.scheduledTime) {
						if (typeof reminder.scheduledTime.toDate === 'function') {
							scheduledTime = DateTime.fromJSDate(reminder.scheduledTime.toDate());
						} else if (reminder.scheduledTime instanceof Date) {
							scheduledTime = DateTime.fromJSDate(reminder.scheduledTime);
						} else if (typeof reminder.scheduledTime === 'string') {
							scheduledTime = DateTime.fromISO(reminder.scheduledTime);
						} else if (typeof reminder.scheduledTime === 'number') {
							scheduledTime = DateTime.fromMillis(reminder.scheduledTime);
						}
					}
					if (!scheduledTime) {
						console.warn('Could not parse scheduledTime for reminder:', reminder);
						return false;
					}
					return reminder.status === 'pending' && scheduledTime <= now;
				} catch (error) {
					console.warn('Error processing reminder date:', error, reminder);
					return false;
				}
			});

			// Load stored follow-up reminders from AsyncStorage
			const storedFollowUp = await AsyncStorage.getItem('follow_up_notifications');
			const localFollowUpReminders = storedFollowUp ? JSON.parse(storedFollowUp) : [];

			// Transform stored reminders to match our format
			const processedFollowUps = localFollowUpReminders.map((local) => ({
				type: 'FOLLOW_UP',
				firestoreId: local.id,
				scheduledTime: new Date(local.scheduledTime),
				data: local.data,
				contactName: local.contactName,
				status: 'pending',
			}));

			// Merge and sort reminders
			const sortedReminders = [
				...filteredFirestoreReminders,
				...followUpReminders,
				...processedFollowUps,
			].sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));

			setRemindersState({
				data: sortedReminders,
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
			// Try to cancel the local notification using the reminderId
			try {
				await Notifications.cancelScheduledNotificationAsync(reminderId);
			} catch (error) {
				console.log('No scheduled notification found for:', reminderId);
			}

			// Also try to cancel any presented notifications
			try {
				const presentedNotifications = await Notifications.getPresentedNotificationsAsync();
				const matchingNotification = presentedNotifications.find(
					(n) => n.request.identifier === reminderId || n.request.content.data?.firestoreId === reminderId
				);
				if (matchingNotification) {
					await Notifications.dismissNotificationAsync(matchingNotification.request.identifier);
				}
			} catch (error) {
				console.log('Error dismissing presented notification:', error);
			}

			// Remove from notification coordinator
			const mapping = notificationCoordinator.notificationMap.get(reminderId);
			if (mapping) {
				if (mapping.localId && mapping.localId !== reminderId) {
					try {
						await Notifications.cancelScheduledNotificationAsync(mapping.localId);
					} catch (error) {
						console.log('Error canceling mapped notification:', error);
					}
				}
				notificationCoordinator.notificationMap.delete(reminderId);
				await notificationCoordinator.saveNotificationMap();
			}

			// Handle notes if provided
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

			// Update UI
			setRemindersState((prev) => ({
				...prev,
				data: prev.data.filter((r) => r.firestoreId !== reminderId),
			}));

			// Update badge count
			await notificationCoordinator.decrementBadge();

			// Make sure notification service handles cleanup
			await notificationService.handleFollowUpComplete(reminderId);

			// Persist changes to AsyncStorage
			try {
				const storedNotifications = await AsyncStorage.getItem('follow_up_notifications');
				if (storedNotifications) {
					const notifications = JSON.parse(storedNotifications);
					const updatedNotifications = notifications.filter((n) => n.id !== reminderId);
					await AsyncStorage.setItem('follow_up_notifications', JSON.stringify(updatedNotifications));
				}
			} catch (error) {
				console.error('Error updating stored notifications:', error);
			}
		} catch (error) {
			console.error('Error completing follow-up:', error);
			Alert.alert('Error', 'Failed to complete follow-up');
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

	// Options for snoozing reminders
	const handleSnooze = async (reminder) => {
		if (!reminder?.scheduledTime) {
			console.error('Invalid reminder data:', reminder);
			Alert.alert('Error', 'Unable to snooze reminder');
			return;
		}

		setSelectedReminder(reminder);

		// Get available options based on reminder frequency
		const options = await snoozeHandler.getAvailableSnoozeOptions(reminder.firestoreId);
		setSnoozeOptions(options);
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
			const reminderId = selectedReminder.firestoreId;
			const currentTime = DateTime.now();

			await snoozeHandler.handleSnooze(contactId, option, currentTime, 'SCHEDULED', reminderId);
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
			const cachedContacts = await cacheManager.getCachedUpcomingContacts(user.uid);
			if (cachedContacts) {
				setContacts(
					cachedContacts.sort((a, b) => {
						const dateA = a.next_contact ? new Date(a.next_contact) : new Date(0);
						const dateB = b.next_contact ? new Date(b.next_contact) : new Date(0);
						return dateA - dateB;
					})
				);
			}
		} catch (error) {
			console.error('Error loading contacts:', error);
			Alert.alert('Error', 'Failed to load contacts');
		} finally {
			setLoading(false);
		}
	}

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
			<ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
				{/* Needs Attention Section */}
				{remindersState.data.length > 0 && (
					<View style={styles.needsAttentionSection}>
						<View style={styles.groupHeader}>
							<Text style={styles.groupTitle}>Needs Attention</Text>
						</View>
						<NotificationsView
							reminders={remindersState.data}
							onComplete={handleFollowUpComplete}
							loading={remindersState.loading}
							onSnooze={handleSnooze}
						/>
					</View>
				)}

				{/* Upcoming Calls Section */}
				<View style={styles.section}>
					<View style={styles.groupHeader}>
						<Text style={styles.groupTitle}>Upcoming Calls</Text>
					</View>
					{loading ? (
						<Text style={commonStyles.message}>Loading contacts...</Text>
					) : contacts.length === 0 ? (
						<Text style={commonStyles.message}>No upcoming contacts</Text>
					) : (
						contacts
							.filter((contact) => contact.next_contact) // Only include contacts with next_contact
							.map((contact) => {
								let formattedDate = null;
								try {
									if (contact.next_contact) {
										// Handle Firestore timestamp object
										if (contact.next_contact instanceof Object && contact.next_contact.seconds) {
											formattedDate = new Date(contact.next_contact.seconds * 1000).toISOString();
										}
										// Handle Firebase timestamp with toDate method
										else if (contact.next_contact.toDate) {
											formattedDate = contact.next_contact.toDate().toISOString();
										}
										// Handle string ISO date
										else if (typeof contact.next_contact === 'string') {
											formattedDate = contact.next_contact;
										}
										// Handle Date object
										else if (contact.next_contact instanceof Date) {
											formattedDate = contact.next_contact.toISOString();
										}
										// Log unhandled formats for debugging
										else {
											console.warn(
												'Unhandled next_contact format:',
												typeof contact.next_contact,
												contact.next_contact
											);
										}
									}
								} catch (error) {
									console.warn('Error formatting date for contact:', contact.id, error);
									return null;
								}

								if (!formattedDate) {
									console.warn('Could not format date for contact:', contact.id, contact.next_contact);
									return null;
								}

								return (
									<TouchableOpacity
										key={contact.id}
										style={[styles.upcomingContactCard, { alignItems: 'center' }]}
										onPress={() => navigation.navigate('ContactDetails', { contact, initialTab: 'Schedule' })}
									>
										<View style={[styles.cardHeader, { justifyContent: 'center' }]}>
											<View style={styles.avatarContainer}>
												{contact.photo_url ? (
													<ExpoImage
														source={{ uri: contact.photo_url }}
														style={styles.avatar}
														cachePolicy="memory-disk"
														transition={200}
													/>
												) : (
													<Icon name="person-outline" size={24} color={colors.primary} />
												)}
											</View>
											<View style={styles.upcomingContactInfo}>
												<Text style={styles.upcomingContactName}>
													{contact.first_name} {contact.last_name}
												</Text>
												<Text style={styles.upcomingContactDate}>
													{new Date(formattedDate).toLocaleDateString('en-US', {
														month: 'long',
														day: 'numeric',
														year: 'numeric',
													})}
												</Text>
											</View>
										</View>
									</TouchableOpacity>
								);
							})
							.filter(Boolean)
					)}
				</View>
			</ScrollView>

			<ActionModal
				show={showSnoozeOptions}
				onClose={() => {
					setShowSnoozeOptions(false);
					setSelectedReminder(null);
					setSnoozeError(null);
				}}
				loading={snoozeLoading}
				error={snoozeError}
				options={snoozeOptions}
				onSelect={handleSnoozeSelection}
			/>
		</View>
	);
}
