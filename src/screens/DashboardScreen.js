import React, { useState, useEffect, useRef } from 'react';
import {
	Text,
	View,
	ScrollView,
	TouchableOpacity,
	RefreshControl,
	Alert,
	KeyboardAvoidingView,
	Platform,
	ActivityIndicator,
} from 'react-native';
import { useStyles } from '../styles/screens/dashboard';
import { useCommonStyles } from '../styles/common';
import { useTheme, spacing } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { Image as ExpoImage } from 'expo-image';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {
	fetchUpcomingContacts,
	subscribeToContacts,
	completeScheduledReminder,
	subscribeToReminders,
	updateReminder,
} from '../utils/firestore';
import { NotificationsView } from '../components/dashboard/NotificationsView';
import { notificationService } from '../utils/notifications';
import { eventEmitter } from '../utils/notifications';
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
	orderBy,
} from 'firebase/firestore';
import { OPTION_TYPES, REMINDER_TYPES, SNOOZE_LIMIT_MESSAGES } from '../../constants/notificationConstants';
import { db, auth } from '../config/firebase';
import { cacheManager } from '../utils/cache';
import { snoozeHandler, initializeSnoozeHandler } from '../utils/scheduler/snoozeHandler';
import { DateTime } from 'luxon';
import { notificationCoordinator } from '../utils/notificationCoordinator';
import * as Notifications from 'expo-notifications';
import { calculateStats } from './stats/statsCalculator';
import CallOptions from '../components/general/CallOptions';
import { getContactById } from '../utils/firestore';

const getScheduledReminders = async (userId) => {
	const remindersRef = collection(db, 'reminders');
	const scheduledQuery = query(
		remindersRef,
		where('user_id', '==', userId),
		where('type', '==', 'SCHEDULED'),
		where('status', 'in', ['pending', 'sent']),
		orderBy('scheduledTime', 'desc')
	);
	const snapshot = await getDocs(scheduledQuery);
	return snapshot.docs.map((doc) => ({
		firestoreId: doc.id,
		...doc.data(),
		scheduledTime: doc.data().scheduledTime?.toDate(),
	}));
};

const getCustomReminders = async (userId) => {
	const remindersRef = collection(db, 'reminders');
	const customQuery = query(
		remindersRef,
		where('user_id', '==', userId),
		where('type', '==', 'CUSTOM_DATE'),
		where('status', 'in', ['pending', 'sent']),
		orderBy('scheduledTime', 'desc')
	);
	const snapshot = await getDocs(customQuery);
	return snapshot.docs.map((doc) => ({
		firestoreId: doc.id,
		...doc.data(),
		scheduledTime: doc.data().scheduledTime?.toDate(),
	}));
};

const getFollowUpReminders = async (userId) => {
	const remindersRef = collection(db, 'reminders');
	const followUpQuery = query(
		remindersRef,
		where('user_id', '==', userId),
		where('type', '==', 'FOLLOW_UP'),
		where('status', 'in', ['pending', 'sent']),
		orderBy('scheduledTime', 'desc')
	);
	const snapshot = await getDocs(followUpQuery);
	return snapshot.docs.map((doc) => ({
		firestoreId: doc.id,
		...doc.data(),
		scheduledTime: doc.data().scheduledTime?.toDate(),
	}));
};

// Customize snooze text based on time of day
const customizeSnoozeText = (option) => {
	if (option.id === 'later_today') {
		const now = new Date();
		const currentHour = now.getHours();
		return currentHour >= 23 ? 'Early Tomorrow' : option.text;
	}
	return option.text;
};

const groupByContact = (reminders) => {
	return reminders.reduce((acc, reminder) => {
		if (!acc[reminder.contact_id]) {
			acc[reminder.contact_id] = [];
		}
		acc[reminder.contact_id].push(reminder);
		return acc;
	}, {});
};

const getNewestPerContact = (groupedReminders) => {
	return Object.values(groupedReminders).map((group) =>
		group.reduce((newest, current) =>
			new Date(current.scheduledTime) > new Date(newest.scheduledTime) ? current : newest
		)
	);
};

export default function DashboardScreen({ navigation, route }) {
	const { user } = useAuth();
	const { colors } = useTheme();
	const styles = useStyles();
	const commonStyles = useCommonStyles();
	const [isLoading, setIsLoading] = useState(true);
	const initialLoadCompletedRef = useRef(false);
	const [contacts, setContacts] = useState([]);
	const [refreshing, setRefreshing] = useState(false);
	const [loading, setLoading] = useState(true);
	const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
	const [snoozeOptions, setSnoozeOptions] = useState([]);
	const [snoozeLoading, setSnoozeLoading] = useState(false);
	const [snoozeError, setSnoozeError] = useState(null);
	const [selectedReminder, setSelectedReminder] = useState(null);
	const [stats, setStats] = useState(null);
	const [showCallOptions, setShowCallOptions] = useState(false);
	const [selectedContact, setSelectedContact] = useState(null);
	const [isOffline, setIsOffline] = useState(false);

	const [remindersState, setRemindersState] = useState({
		data: [],
		loading: true,
		error: null,
	});

	// Setup network status listener
	useEffect(() => {
		const unsubscribe = NetInfo.addEventListener((state) => {
			setIsOffline(!state.isConnected);
		});

		// Initial check
		NetInfo.fetch().then((state) => {
			setIsOffline(!state.isConnected);
		});

		return () => {
			unsubscribe();
		};
	}, []);

	useEffect(() => {
		if (route.params?.initialView === 'notifications') {
			if (route.params?.highlightReminderId) {
			}
		}
		// Handle notification snooze actions
		if (route.params?.openSnoozeForReminder) {
			const reminderToSnooze = route.params.openSnoozeForReminder;
			// Clear params first to prevent re-triggering
			if (navigation.setParams) {
				navigation.setParams({ openSnoozeForReminder: undefined });
			}
			// Open the snooze options dialog
			handleSnooze(reminderToSnooze);
		}
		// Handle notification call options actions
		if (route.params?.openCallOptionsForContact) {
			const contact = route.params.openCallOptionsForContact;
			const reminderToComplete = route.params.reminderToComplete;
			// Clear params first to prevent re-triggering
			if (navigation.setParams) {
				navigation.setParams({
					openCallOptionsForContact: undefined,
					reminderToComplete: undefined,
				});
			}
			// Set selected contact and reminder for the modal
			setSelectedContact(contact);
			setSelectedReminder(reminderToComplete);
			// Show call options modal
			setShowCallOptions(true);
		}
	}, [route.params]);

	useFocusEffect(
		React.useCallback(() => {
			if (user) {
				loadContacts();
				loadReminders();
				loadStats();

				const contactsUnsubscribe = subscribeToContacts(user.uid, async (contactsList) => {
					const upcomingContacts = await fetchUpcomingContacts(user.uid);
					if (upcomingContacts) {
						setContacts(
							upcomingContacts.sort((a, b) => {
								const dateA = a.next_contact ? new Date(a.next_contact) : new Date(0);
								const dateB = b.next_contact ? new Date(b.next_contact) : new Date(0);
								return dateA - dateB;
							})
						);
					}
				});

				const remindersUnsubscribe = subscribeToReminders(user.uid, 'sent', () => {
					loadReminders();
				});

				return () => {
					if (contactsUnsubscribe) {
						contactsUnsubscribe();
					}
					if (remindersUnsubscribe) {
						remindersUnsubscribe();
					}
				};
			}
		}, [user])
	);

	useEffect(() => {
		const listener = () => loadReminders();
		eventEmitter.on('followUpCreated', listener);

		return () => {
			eventEmitter.off('followUpCreated', listener);
		};
	}, []);

	const loadReminders = async () => {
		try {
			if (!initialLoadCompletedRef.current) {
				setIsLoading(true);
			}

			const [scheduledReminders, customReminders, followUpReminders] = await Promise.all([
				getScheduledReminders(user.uid),
				getCustomReminders(user.uid),
				getFollowUpReminders(user.uid),
			]);

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
					firestoreId: data.firestoreId || notification.identifier,
					scheduledTime: callTime,
					contact_id: data.contactId,
					contactName: data.contactName || 'Unknown Contact',
					status: 'pending',
					data: data,
				};
			};

			const followUpFromNotifications = scheduledNotifications
				.filter((notification) => notification.content?.data?.type === 'FOLLOW_UP')
				.map(processReminder);

			const storedFollowUp = await AsyncStorage.getItem('follow_up_notifications');
			const localFollowUpReminders = storedFollowUp ? JSON.parse(storedFollowUp) : [];

			const processedFollowUps = localFollowUpReminders.map((local) => ({
				type: 'FOLLOW_UP',
				firestoreId: local.id,
				scheduledTime: new Date(local.scheduledTime),
				data: local.data,
				contactName: local.contactName,
				status: 'pending',
			}));

			const now = DateTime.now();
			const sevenDaysAgo = now.minus({ days: 7 }).toJSDate();

			const allFollowUps = [...followUpReminders, ...followUpFromNotifications, ...processedFollowUps].filter(
				(r) => new Date(r.scheduledTime) >= sevenDaysAgo
			);

			const groupedScheduled = groupByContact(
				scheduledReminders.filter(
					(r) =>
						(new Date(r.scheduledTime) <= now.toJSDate() || r.status === 'sent') && r.status !== 'completed'
				)
			);
			const newestScheduled = getNewestPerContact(groupedScheduled);

			const groupedCustom = groupByContact(
				customReminders.filter(
					(r) =>
						(new Date(r.scheduledTime) <= now.toJSDate() || r.status === 'sent') && r.status !== 'completed'
				)
			);
			const newestCustom = getNewestPerContact(groupedCustom);

			const sortedReminders = [...allFollowUps, ...newestScheduled, ...newestCustom].sort(
				(a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime)
			);

			setRemindersState({
				data: sortedReminders,
				loading: false,
				error: null,
			});

			initialLoadCompletedRef.current = true;
			setIsLoading(false);
		} catch (error) {
			console.error('[DashboardScreen] Error loading reminders:', error);
			setRemindersState({
				data: [],
				loading: false,
				error: 'Failed to load reminders',
			});

			initialLoadCompletedRef.current = true;
			setIsLoading(false);
			Alert.alert('Error', 'Failed to load reminders');
		}
	};

	const handleReminderComplete = async (reminderId, notes = '') => {
		try {
			const reminder = remindersState.data.find((r) => r.firestoreId === reminderId);
			if (!reminder) {
				console.error('Reminder not found:', reminderId);
				return;
			}

			switch (reminder.type) {
				case 'SCHEDULED':
				case 'CUSTOM_DATE':
					await completeScheduledReminder(reminderId, reminder.contact_id);
					break;
				case 'FOLLOW_UP':
					await handleFollowUpComplete(reminderId, notes);
					return;
				default:
					console.error('Unknown reminder type:', reminder.type);
					return;
			}

			try {
				try {
					await Notifications.cancelScheduledNotificationAsync(reminderId);
				} catch (error) {
					console.log('No scheduled notification found for:', reminderId);
				}

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

				await notificationCoordinator.decrementBadge();
			} catch (notificationError) {
				console.error('Error cleaning up notifications:', notificationError);
			}

			setRemindersState((prev) => ({
				...prev,
				data: prev.data.filter((r) => r.firestoreId !== reminderId),
			}));
		} catch (error) {
			console.error('Error completing reminder:', error);
			Alert.alert('Error', 'Failed to complete reminder');
		}
	};

	const handleFollowUpComplete = async (reminderId, notes) => {
		try {
			try {
				await Notifications.cancelScheduledNotificationAsync(reminderId);
			} catch (error) {
				console.log('No scheduled notification found for:', reminderId);
			}

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

			setRemindersState((prev) => ({
				...prev,
				data: prev.data.filter((r) => r.firestoreId !== reminderId),
			}));

			await notificationCoordinator.decrementBadge();

			await notificationService.handleFollowUpComplete(reminderId);

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

	// Function to handle contact now action
	const handleContactNow = async (contactId) => {
		try {
			const contact = await getContactById(contactId);
			if (!contact) {
				Alert.alert('Error', 'Could not find contact information');
				return;
			}

			setSelectedContact({
				...contact,
				first_name: contact.first_name,
				last_name: contact.last_name,
				phone: contact.phone,
			});
			setShowCallOptions(true);

			// Mark the reminder as completed if there's a selected reminder
			if (selectedReminder?.firestoreId) {
				await handleReminderComplete(selectedReminder.firestoreId);
			}
		} catch (error) {
			console.error('Error handling contact now:', error);
			Alert.alert('Error', 'Could not initiate contact');
		}
	};

	// Use enhanced snooze options with stats
	const handleSnooze = async (reminder) => {
		if (!reminder?.scheduledTime) {
			console.error('Invalid reminder data:', reminder);
			Alert.alert('Error', 'Unable to snooze reminder');
			return;
		}

		// Show offline warning if needed
		if (isOffline) {
			Alert.alert(
				'Limited Connection',
				'You appear to be offline. Snooze requests will be processed when your connection is restored.',
				[{ text: 'Continue' }]
			);
		}

		try {
			setSnoozeLoading(true);
			// Get enhanced options with stats
			const options = await snoozeHandler.getAvailableSnoozeOptions(reminder.firestoreId);

			if (!options || options.length === 0) {
				Alert.alert('Error', 'No available snooze options');
				setSnoozeLoading(false);
				return;
			}

			// Save selected reminder for context
			setSelectedReminder(reminder);

			// Add handlers to options
			const optionsWithHandlers = options.map((option) => {
				// Special handling for "contact_now" option
				if (option.id === OPTION_TYPES.CONTACT_NOW) {
					return {
						...option,
						onPress: () => {
							setShowSnoozeOptions(false);
							handleContactNow(reminder.contact_id);
						},
					};
				}

				// Special handling for "reschedule" option
				if (option.id === OPTION_TYPES.RESCHEDULE) {
					return {
						...option,
						onPress: async () => {
							setShowSnoozeOptions(false);

							try {
								// Get full contact details to pass to navigation
								const contact = await getContactById(reminder.contact_id);
								if (!contact) {
									console.error('Contact not found for reminder:', reminder);
									Alert.alert('Error', 'Could not find contact information');
									return;
								}

								// Navigate to contact's schedule tab
								navigation.navigate('ContactDetails', {
									contact: contact,
									initialTab: 'Schedule',
								});
							} catch (error) {
								console.error('Error navigating to contact schedule:', error);
								Alert.alert('Error', 'Could not open contact details');
							}
						},
					};
				}

				// Default handling for other options
				return {
					...option,
					onPress: async () => {
						setSnoozeLoading(true);
						setSnoozeError(null);

						try {
							await initializeSnoozeHandler(user.uid);

							// If offline, store operation for later
							if (isOffline) {
								// Store pending operation
								await notificationCoordinator.storePendingOperation({
									type: 'snooze',
									data: {
										contactId: reminder.contact_id,
										optionId: option.id,
										reminderType: reminder.type || 'SCHEDULED',
										reminderId: reminder.firestoreId,
									},
								});

								// Optimistically update UI
								setShowSnoozeOptions(false);
								setSnoozeLoading(false);

								Alert.alert(
									'Operation Queued',
									'Your snooze request will be processed when your connection is restored.',
									[{ text: 'OK' }]
								);
								return;
							}

							// Online operation
							await snoozeHandler.handleSnooze(
								reminder.contact_id,
								option.id,
								DateTime.now(),
								reminder.type || 'SCHEDULED',
								reminder.firestoreId
							);

							setShowSnoozeOptions(false);
							await loadReminders();
						} catch (error) {
							console.error('Error in snooze process:', error);
							setSnoozeError(error.message || 'Unable to snooze reminder. Please try again.');
						} finally {
							setSnoozeLoading(false);
						}
					},
				};
			});

			setSnoozeOptions(optionsWithHandlers);

			// Pass stats to ActionModal
			setShowSnoozeOptions(true);
			setSnoozeLoading(false);
		} catch (error) {
			console.error('Error preparing snooze options:', error);
			setSnoozeError('Failed to prepare snooze options.');
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

			const freshContacts = await fetchUpcomingContacts(user.uid);
			if (freshContacts) {
				setContacts(
					freshContacts.sort((a, b) => {
						const dateA = a.next_contact ? new Date(a.next_contact) : new Date(0);
						const dateB = b.next_contact ? new Date(b.next_contact) : new Date(0);
						return dateA - dateB;
					})
				);
				await cacheManager.saveUpcomingContacts(user.uid, freshContacts);
			}
		} catch (error) {
			console.error('Error loading contacts:', error);
			Alert.alert('Error', 'Failed to load contacts');
		} finally {
			setLoading(false);
		}
	}

	const loadStats = async () => {
		if (!user) return;
		try {
			const cachedStats = await cacheManager.getCachedStats(user.uid);
			if (cachedStats) {
				setStats(cachedStats);
			}

			const calculatedStats = await calculateStats(user.uid);
			setStats(calculatedStats);
			await cacheManager.saveStats(user.uid, calculatedStats);
		} catch (error) {
			console.error('Error loading stats:', error);
		}
	};

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

	if (isLoading && !initialLoadCompletedRef.current) {
		return (
			<View style={[commonStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
				<ActivityIndicator size="extra-large" color={colors.primary} />
			</View>
		);
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
			style={{ flex: 1, backgroundColor: colors.background.primary }}
			keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
		>
			<View style={[commonStyles.container, { backgroundColor: 'transparent' }]}>
				<StatusBar style="auto" />

				{/* Offline indicator */}
				{isOffline && (
					<View
						style={{
							backgroundColor: colors.primary || '#FFA500',
							padding: spacing.sm,
							marginTop: spacing.xs,
							alignItems: 'center',
						}}
					>
						<Text
							style={{
								color: colors.text.white,
								fontWeight: 800,
								textAlign: 'center',
							}}
						>
							Offline Mode
						</Text>
						<Text
							style={{
								color: colors.text.white,
								fontSize: 12,
								fontWeight: 600,
								textAlign: 'center',
								opacity: 0.9,
							}}
						>
							Will Sync When Connection Is Restored
						</Text>
					</View>
				)}

				<ScrollView
					style={{ flex: 1 }}
					refreshControl={<RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} />}
					keyboardShouldPersistTaps="always"
					keyboardDismissMode="none"
				>
					{/* Reminders Section */}
					<View style={styles.needsAttentionSection}>
						<View style={commonStyles.pageHeader}>
							<Icon name="grid-outline" size={22} style={commonStyles.pageHeaderIcon} />
							<Text style={commonStyles.pageHeaderTitle}>Reminders</Text>
						</View>

						{remindersState.data.length > 0 ? (
							<NotificationsView
								reminders={remindersState.data}
								onComplete={handleReminderComplete}
								loading={remindersState.loading}
								onSnooze={handleSnooze}
							/>
						) : (
							<View style={styles.remindersEmptyState}>
								<View style={styles.emptyStateTitleRow}>
									<Icon name="checkmark-circle-outline" size={24} color={colors.success} />
									<Text style={[styles.emptyStateTitle, { color: colors.success, marginLeft: spacing.sm }]}>
										You're caught up!
									</Text>
								</View>
								<Text style={styles.emptyStateMessage}>
									Reminders will appear here when it's time to connect with your contacts.
								</Text>
							</View>
						)}
					</View>

					{/* Suggested Calls Section - only show when not empty */}
					{stats?.detailed?.needsAttention && stats.detailed.needsAttention.length > 0 && (
						<View style={styles.section}>
							<View style={commonStyles.card}>
								<View style={styles.groupHeader}>
									<Text style={styles.groupTitle}>Suggested Calls</Text>
								</View>

								{/* Explanation text */}
								<Text style={styles.contactReason}>Based on your contact schedules</Text>

								<View>
									{stats.detailed.needsAttention.map((contact, index, array) => (
										<View
											key={contact.id}
											style={[
												styles.attentionItem,
												index !== array.length - 1 && {
													borderBottomWidth: 1,
													borderBottomColor: colors.border,
												},
											]}
										>
											<View style={styles.attentionInfo}>
												<Text style={styles.contactName}>{contact.name}</Text>
											</View>
											<TouchableOpacity
												style={styles.callButton}
												onPress={() => {
													const formattedContact = {
														...contact,
														first_name: contact.name.split(' ')[0],
														last_name: contact.name.split(' ').slice(1).join(' '),
														phone: contact.phone,
													};
													setSelectedContact(formattedContact);
													setShowCallOptions(true);
												}}
											>
												<Text style={styles.callButtonText}>Contact</Text>
											</TouchableOpacity>
										</View>
									))}
								</View>
							</View>
						</View>
					)}
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
					title="Snooze Options"
					statusMessage={snoozeOptions[0]?.stats?.isExhausted ? snoozeOptions[0]?.stats?.message : null}
					statusIndicator={snoozeOptions[0]?.stats?.indicator}
					frequencyMessage={snoozeOptions[0]?.stats?.frequencySpecific}
					customizeOptionText={customizeSnoozeText}
					onStatusMessagePress={
						// Link Handler if theres is a RECURRING_MAX_REACHED message AND a reschedule option
						snoozeOptions[0]?.stats?.message === SNOOZE_LIMIT_MESSAGES.RECURRING_MAX_REACHED &&
						snoozeOptions.some((opt) => opt.id === OPTION_TYPES.RESCHEDULE)
							? () => {
									// Find reschedule option
									const rescheduleOption = snoozeOptions.find((opt) => opt.id === OPTION_TYPES.RESCHEDULE);
									setShowSnoozeOptions(false);
									// Short delay to so modal is closed before navigating
									setTimeout(() => {
										if (rescheduleOption && rescheduleOption.onPress) {
											rescheduleOption.onPress();
										}
									}, 300);
							  }
							: null
					}
				/>
			</View>
			{selectedContact && (
				<CallOptions
					show={showCallOptions}
					contact={selectedContact}
					reminder={selectedReminder}
					onComplete={handleReminderComplete}
					onClose={() => {
						setShowCallOptions(false);
						setSelectedContact(null);
						setSelectedReminder(null);
					}}
				/>
			)}
		</KeyboardAvoidingView>
	);
}
