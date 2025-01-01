import { Platform, Linking, Alert } from 'react-native';
import { addContactHistory, updateNextContact } from './firestore';
import Constants from 'expo-constants';
import { notificationService } from './notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_CALL_KEY = '@CallHandler:activeCall';

export class CallHandler {
	constructor() {
		this.initialized = false;
		this.activeCall = null;
	}

	async initiateCall(contact, callType = 'phone') {
		console.log('[CallHandler] Initiating call:', { contact: contact.id, type: callType });

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
			console.log('[CallHandler] Saved call data:', callData);

			// Initialize notification service
			await notificationService.initialize();
			console.log('[CallHandler] Notification service initialized');

			// Schedule follow-up notification (5 seconds for testing)
			const notificationTime = new Date(Date.now() + 5000);
			console.log('[CallHandler] Scheduling notification for:', notificationTime);

			const notificationId = await notificationService.scheduleCallFollowUp(
				{
					...contact,
					callData: {
						type: callType,
						startTime: callData.startTime,
					},
				},
				notificationTime
			);

			console.log('[CallHandler] Notification scheduled');

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
				console.log('[CallHandler] No active call found to process');
				return;
			}

			const callData = JSON.parse(savedCallData);
			const contact = callData.contact;
			const callEndTime = new Date();
			const startTime = new Date(callData.startTime);
			const callDuration = (callEndTime.getTime() - startTime.getTime()) / 1000;

			console.log('[CallHandler] Processing call end. Duration:', callDuration);

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

			console.log('[CallHandler] Call end processed successfully');
		} catch (error) {
			console.error('[CallHandler] Error processing call end:', error);
			throw error;
		} finally {
			await AsyncStorage.removeItem(ACTIVE_CALL_KEY);
		}
	}
}

export const callHandler = new CallHandler();
