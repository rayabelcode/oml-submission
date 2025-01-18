import { Platform, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationService } from './notifications';

const ACTIVE_CALL_KEY = '@CallHandler:activeCall';

class CallHandler {
	constructor() {
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

			const callData = {
				contact,
				startTime: new Date().toISOString(),
				type: callType,
			};

			await AsyncStorage.setItem(ACTIVE_CALL_KEY, JSON.stringify(callData));
			await this.notificationService.initialize();

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

			await Linking.openURL(urlScheme);
			return true;
		} catch (error) {
			console.error('[CallHandler] Error in initiateCall:', error);
			await AsyncStorage.removeItem(ACTIVE_CALL_KEY);
			Alert.alert('Call Error', error.message || 'Could not initiate call');
			return false;
		}
	}

	async handleCallAction(contact, type, onClose) {
		try {
			await this.initiateCall(contact, type);
			if (onClose) onClose();
		} catch (error) {
			console.error('[CallHandler] Error handling call action:', error);
			if (onClose) onClose();
		}
	}
}

export const callHandler = new CallHandler();
