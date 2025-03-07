import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';
import { snoozeHandler, initializeSnoozeHandler } from '../scheduler/snoozeHandler';
import { callNotesService } from '../callNotes';
import { REMINDER_TYPES, SNOOZE_OPTIONS } from '../../../constants/notificationConstants';
import { navigate } from '../../navigation/RootNavigation';
import { getContactById } from '../firestore';
import { callHandler } from '../callHandler';
import { auth } from '../../config/firebase';
import { DateTime } from 'luxon';

export const handleNotificationResponse = async (response) => {
	const data = response.notification.request.content.data || {};

	// Find the reminder ID - it could be in different fields depending on the notification source
	const reminderId = data.reminderId || data.id || data.firestoreId;

	switch (data.type) {
		case REMINDER_TYPES.SCHEDULED:
		case REMINDER_TYPES.CUSTOM_DATE:
			if (response.actionIdentifier === 'call_now') {
				try {
					const contact = await getContactById(data.contactId);
					if (contact) {
						Alert.alert('Contact Options', `How would you like to contact ${contact.first_name}?`, [
							{
								text: 'Phone',
								// Standard phone call
								onPress: () => callHandler.initiateCall(contact, 'phone'),
							},
							{
								text: 'FaceTime',
								// FaceTime Video call
								onPress: () => callHandler.initiateCall(contact, 'facetime-video'),
							},
							{
								text: 'Text',
								// Text Message
								onPress: () => callHandler.initiateCall(contact, 'sms'),
							},
							{
								text: 'Cancel',
								style: 'cancel',
							},
						]);
					}
				} catch (error) {
					console.error('Error initiating call:', error);
				}
			} else if (response.actionIdentifier === 'snooze') {
				try {
					const userId = auth.currentUser?.uid;

					if (!userId) {
						console.error('No user ID available for snooze handling');
						Alert.alert('Error', 'Please make sure you are logged in to snooze reminders.');
						return;
					}

					// Check for offline status
					const networkState = await NetInfo.fetch();
					if (!networkState.isConnected) {
						Alert.alert(
							'Offline Mode',
							'You are currently offline. Snooze actions will be applied when you reconnect.',
							[{ text: 'Continue' }, { text: 'Cancel', style: 'cancel' }],
							{ cancelable: true }
						);
						// Continue with offline handling if user chooses "Continue"
					}

					await initializeSnoozeHandler(userId);

					// Get enhanced options with stats
					let options = [];
					if (reminderId) {
						try {
							options = await snoozeHandler.getAvailableSnoozeOptions(reminderId);
						} catch (optionError) {
							console.error('Error getting snooze options:', optionError);
						}
					}

					if (!options || options.length === 0) {
						options = SNOOZE_OPTIONS;
					}

					// Get stats from first option (all have same stats)
					const stats = options[0]?.stats;
					let title = 'Snooze Options';
					let message = 'When would you like to be reminded?';

					// Special handling for daily reminders that have exhausted snoozes
					const reminder = await getReminder(reminderId);
					const frequency = reminder?.frequency || 'default';

					if (stats?.isExhausted && frequency === 'daily') {
						title = 'Daily Reminder';
						message = SNOOZE_LIMIT_MESSAGES.DAILY_MAX_REACHED;

						const buttons = [
							{
								text: 'Contact Now',
								onPress: async () => {
									try {
										const contact = await getContactById(data.contactId);
										if (contact) {
											callHandler.handleCallAction(contact);
										}
									} catch (error) {
										console.error('Error initiating call:', error);
										Alert.alert('Error', 'Could not initiate contact');
									}
								},
							},
							{
								text: 'Skip',
								style: 'destructive',
								onPress: async () => {
									try {
										await snoozeHandler.handleSkip(data.contactId, DateTime.now(), reminderId);
									} catch (error) {
										console.error('Error skipping reminder:', error);
										Alert.alert('Error', 'Failed to skip reminder');
									}
								},
							},
							{
								text: 'Cancel',
								style: 'cancel',
							},
						];

						Alert.alert(title, message, buttons);
						return;
					}

					// Handling for reminders that have exhausted snoozes (except daily)
					if (stats?.isExhausted) {
						title = 'Scheduling Suggestion';
						message = SNOOZE_LIMIT_MESSAGES.RECURRING_MAX_REACHED;

						const buttons = [
							{
								text: 'Later Today',
								onPress: async () => {
									try {
										await snoozeHandler.handleLaterToday(
											data.contactId,
											DateTime.now(),
											data.type,
											reminderId
										);
									} catch (error) {
										console.error('Error processing snooze:', error);
										Alert.alert('Error', 'Failed to snooze reminder');
									}
								},
							},
							{
								text: 'Tomorrow',
								onPress: async () => {
									try {
										await snoozeHandler.handleTomorrow(data.contactId, DateTime.now(), data.type, reminderId);
									} catch (error) {
										console.error('Error processing snooze:', error);
										Alert.alert('Error', 'Failed to snooze reminder');
									}
								},
							},
							{
								text: 'Reschedule',
								onPress: () => {
									// Navigate to the contact's schedule screen
									navigate('ContactDetails', {
										contact: { id: data.contactId },
										initialTab: 'Schedule',
									});
								},
							},
							{
								text: 'Skip',
								style: 'destructive',
								onPress: async () => {
									try {
										await snoozeHandler.handleSkip(data.contactId, DateTime.now(), reminderId);
									} catch (error) {
										console.error('Error skipping reminder:', error);
										Alert.alert('Error', 'Failed to skip reminder');
									}
								},
							},
							{
								text: 'Cancel',
								style: 'cancel',
							},
						];

						Alert.alert(title, message, buttons);
						return;
					}

					// Normal handling for other cases
					if (stats) {
						if (stats.frequencySpecific) {
							message = `${stats.frequencySpecific}\n${message}`;
						}
						if (stats.message) {
							title = `Snooze Options (${stats.message})`;
						}
					}

					// Create buttons for alert from available options
					const buttons = options.map((option) => {
						// Handle special option types
						if (option.id === OPTION_TYPES.CONTACT_NOW) {
							return {
								text: option.text,
								onPress: async () => {
									try {
										const contact = await getContactById(data.contactId);
										if (contact) {
											callHandler.handleCallAction(contact);
										}
									} catch (error) {
										console.error('Error initiating call:', error);
										Alert.alert('Error', 'Could not initiate contact');
									}
								},
							};
						}

						if (option.id === OPTION_TYPES.RESCHEDULE) {
							return {
								text: option.text,
								onPress: () => {
									navigate('ContactDetails', {
										contact: { id: data.contactId },
										initialTab: 'Schedule',
									});
								},
							};
						}

						// Standard snooze options
						return {
							text: option.text,
							style: option.id === 'skip' ? 'destructive' : 'default',
							onPress: async () => {
								try {
									await snoozeHandler.handleSnooze(
										data.contactId,
										option.id,
										DateTime.now(),
										data.type,
										reminderId
									);
								} catch (error) {
									console.error('Error processing snooze:', error);
									// Store failed operation for sync later if offline
									if (!networkState.isConnected) {
										await notificationCoordinator.storePendingOperation({
											type: 'snooze',
											data: {
												contactId: data.contactId,
												optionId: option.id,
												reminderId: reminderId,
												reminderType: data.type,
											},
										});
										Alert.alert(
											'Operation Queued',
											'Your snooze request will be processed when back online.'
										);
									} else {
										Alert.alert('Error', 'Failed to snooze reminder. Please try again.');
									}
								}
							},
						};
					});

					buttons.push({
						text: 'Cancel',
						style: 'cancel',
					});

					Alert.alert(title, message, buttons);
				} catch (error) {
					console.error('Error handling snooze options:', error);
					Alert.alert('Error', 'Could not process snooze request. Please try again later.');
				}
			} else if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
				// If the notification is tapped (default action), navigate to the contact's Notes tab
				try {
					const contact = await getContactById(data.contactId);
					if (contact) {
						navigate('ContactDetails', {
							contact: contact,
							initialTab: 'Notes',
							reminderId: reminderId,
						});
					}
				} catch (error) {
					console.error('Error navigating to contact:', error);
				}
			}
			break;

		case REMINDER_TYPES.FOLLOW_UP:
			if (response.actionIdentifier === 'add_notes') {
				const notes = response.userText?.trim();
				const followUpId = data.followUpId || data.firestoreId;
				if (notes && followUpId) {
					await callNotesService.handleFollowUpComplete(followUpId, notes);
				}
			} else if (response.actionIdentifier === 'dismiss') {
				const followUpId = data.followUpId || data.firestoreId;
				if (followUpId) {
					await callNotesService.handleFollowUpComplete(followUpId);
				}
			} else if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
				// If FOLLOW_UP notification is tapped, navigate to contact's Notes tab
				try {
					const contact = await getContactById(data.contactId);
					if (contact) {
						navigate('ContactDetails', {
							contact: contact,
							initialTab: 'Notes',
							reminderId: data.followUpId || data.firestoreId,
						});
					}
				} catch (error) {
					console.error('Error navigating to contact:', error);
				}
			}
			break;
	}
};

export const setupNotificationHandlers = () => {
	return Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
};

// Auto-initialize the handler
setupNotificationHandlers();
