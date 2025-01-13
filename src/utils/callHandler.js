import { Platform, Linking, Alert } from 'react-native';
import { addContactHistory, updateNextContact } from './firestore';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_CALL_KEY = '@CallHandler:activeCall';

export class CallHandler {
	constructor(notificationService) {
		this.initialized = false;
		this.activeCall = null;
		this.notificationService = notificationService;
	}

	async initiateCall(contact, callType = 'phone') {
		try {
			let urlScheme;
			switch (callType) {
				case 'facetime-video':
					urlScheme = `facetime://${contact.phone}`;
					break;
				case 'facetime-audio':
					urlScheme = `facetime-audio://${contact.phone}`;
					break;
				default:
					urlScheme = `tel:${contact.phone}`;
			}

			const canOpen = await Linking.canOpenURL(urlScheme);
			if (!canOpen) {
				const error = new Error(`Cannot make ${callType} call. Please check if the app is installed.`);
				Alert.alert('Call Error', error.message);
				return false;
			}

			// Save call data
			const callData = {
				contact,
				startTime: new Date().toISOString(),
				type: callType,
			};

			await AsyncStorage.setItem(ACTIVE_CALL_KEY, JSON.stringify(callData));

			// Initialize notification service
			await this.notificationService.initialize();

			// Schedule follow-up notification
			const notificationTime = new Date(Date.now() + 5000);

			const notificationId = await this.notificationService.scheduleCallFollowUp(
				{
					...contact,
					callData: {
						type: callType,
						startTime: callData.startTime,
					},
				},
				notificationTime
			);

			// Open call URL
			await Linking.openURL(urlScheme);
			return true;
		} catch (error) {
			console.error('[CallHandler] Error in initiateCall:', error);
			await AsyncStorage.removeItem(ACTIVE_CALL_KEY);
			Alert.alert('Call Error', error.message || 'Could not initiate call');
			return false;
		}
	}

	async processCallEnd() {
		try {
			const savedCallData = await AsyncStorage.getItem(ACTIVE_CALL_KEY);
			if (!savedCallData) {
				return;
			}

			const callData = JSON.parse(savedCallData);
			const contact = callData.contact;
			const callEndTime = new Date();
			const startTime = new Date(callData.startTime);
			const callDuration = (callEndTime.getTime() - startTime.getTime()) / 1000;
			const nextContactDate = new Date();
			nextContactDate.setHours(nextContactDate.getHours() + 1);

			const historyEntry = await addContactHistory(contact.id, {
				date: callEndTime.toISOString(),
				notes: `(${callData.type} call completed - Add your notes)`,
				completed: false,
			});

			await updateNextContact(contact.id, nextContactDate, {
				lastContacted: true,
			});
		} catch (error) {
			console.error('[CallHandler] Error processing call end:', error);
			throw error;
		} finally {
			await AsyncStorage.removeItem(ACTIVE_CALL_KEY);
		}
	}
}
