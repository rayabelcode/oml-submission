// In notificationHandler.js
import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';
import { snoozeHandler, initializeSnoozeHandler } from '../scheduler/snoozeHandler';
import { callNotesService } from '../callNotes';
import {
  REMINDER_TYPES,
  OPTION_TYPES,
} from '../../../constants/notificationConstants';
import { navigate } from '../../navigation/RootNavigation';
import { getContactById } from '../firestore';
import { callHandler } from '../callHandler';
import { auth } from '../../config/firebase';

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
                onPress: () => callHandler.initiateCall(contact, 'phone'),
              },
              {
                text: 'FaceTime',
                onPress: () => callHandler.initiateCall(contact, 'facetime-video'),
              },
              {
                text: 'Text',
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

          // Create a mock reminder object that matches what handleSnooze expects
          const mockReminder = {
            firestoreId: reminderId,
            contact_id: data.contactId,
            type: data.type,
            scheduledTime: new Date(), // This is needed to pass validation
          };
          
          // Navigate to Dashboard screen and trigger the snooze dialog by passing a param
          navigate('Dashboard', { 
            openSnoozeForReminder: mockReminder
          });
        } catch (error) {
          console.error('Error redirecting to snooze options:', error);
          Alert.alert('Error', 'Could not load snooze options. Please try again from the app.');
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
