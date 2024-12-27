import { Platform, Linking, Alert } from 'react-native';
import { addContactHistory, updateNextContact, createFollowUpReminder } from './firestore';
import Constants from 'expo-constants';

// Conditionally import RNCallKeep
const RNCallKeep = Constants.appOwnership === 'expo' ? null : require('react-native-callkeep').default;

export class CallHandler {
	constructor() {
		this.callKeep = RNCallKeep;
		this.initialized = false;
		this.activeCall = null;
	}

	async setup() {
		// Skip CallKeep setup in Expo Go
		if (Constants.appOwnership === 'expo') {
			this.initialized = true;
			return;
		}

		if (this.initialized) return;

		const options = {
			ios: {
				appName: 'OnMyList',
				supportsVideo: true,
				maximumCallGroups: '1',
				maximumCallsPerCallGroup: '1',
				imageName: 'CallKitLogo',
			},
			android: {
				alertTitle: 'Permissions required',
				alertDescription: 'This application needs to access phone accounts',
				cancelButton: 'Cancel',
				okButton: 'OK',
			},
		};

		try {
			await this.callKeep.setup(options);
			this.initialized = true;
			this.setupEventListeners();
		} catch (error) {
			console.error('CallKeep setup error:', error);
		}
	}

	setupEventListeners() {
		// Skip in Expo Go
		if (Constants.appOwnership === 'expo') return;

		this.callKeep.addEventListener('endCall', this.onCallEnded);

		if (Platform.OS === 'ios') {
			this.callKeep.addEventListener('didPerformSetMutedCallAction', this.onMuteCall);
			this.callKeep.addEventListener('answerCall', this.onAnswerCall);
		}
	}

	async initiateCall(contact, callType = 'phone') {
		if (!this.initialized) {
			await this.setup();
		}

		try {
			// Set up activeCall object
			this.activeCall = {
				contact,
				startTime: new Date(),
				uuid: Constants.appOwnership === 'expo' ? 'expo-mock-uuid' : this.callKeep.getNewUUID(),
				type: callType,
			};

			// Only use CallKeep in production build
			if (Constants.appOwnership !== 'expo') {
				await this.callKeep.startCall(
					this.activeCall.uuid,
					contact.phone,
					contact.first_name,
					callType === 'facetime-video'
				);
			}

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
				this.activeCall = null;
				const error = new Error(`Cannot make ${callType} call. Please check if the app is installed.`);
				if (Constants.appOwnership !== 'expo') {
					console.error('Error initiating call:', error);
					Alert.alert('Call Error', error.message);
				}
				return false;
			}

			await Linking.openURL(urlScheme);

			// For Expo Go, simulate a call end after linking
			if (Constants.appOwnership === 'expo') {
				setTimeout(() => {
					this.onCallEnded({ callUUID: 'expo-mock-uuid' });
				}, 1000);
			}

			return true;
		} catch (error) {
			this.activeCall = null;
			if (Constants.appOwnership !== 'expo') {
				console.error('Error initiating call:', error);
				Alert.alert('Call Error', error.message || 'Could not initiate call');
			}
			return false;
		}
	}

	onMuteCall = ({ muted, callUUID }) => {
		console.log('Call muted:', muted);
	};

	onAnswerCall = ({ callUUID }) => {
		console.log('Call answered:', callUUID);
	};

	onCallEnded = ({ callUUID }) => {
		if (!this.activeCall || this.activeCall.uuid !== callUUID) return;

		try {
			const contact = this.activeCall.contact;
			const callDuration = (new Date().getTime() - this.activeCall.startTime.getTime()) / 1000;

			if (callDuration > 10) {
				const followUpDate = new Date();
				followUpDate.setHours(followUpDate.getHours() + 1);

				Promise.all([
					updateNextContact(contact.id, followUpDate, {
						lastContacted: true,
					}),
					createFollowUpReminder(contact.id, followUpDate),
					addContactHistory(contact.id, {
						date: new Date().toISOString(),
						notes: `(${this.activeCall.type} call completed - Add your notes)`,
						completed: false,
					}),
				]).catch((error) => {
					console.error('Error handling call end:', error);
				});
			}
		} finally {
			this.activeCall = null;
		}
	};

	cleanup() {
		if (Constants.appOwnership !== 'expo') {
			this.callKeep.removeEventListener('endCall', this.onCallEnded);
			if (Platform.OS === 'ios') {
				this.callKeep.removeEventListener('didPerformSetMutedCallAction', this.onMuteCall);
				this.callKeep.removeEventListener('answerCall', this.onAnswerCall);
			}
		}
		this.initialized = false;
		this.activeCall = null;
	}
}

export const callHandler = new CallHandler();
