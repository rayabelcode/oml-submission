import { Platform, Linking, Alert } from 'react-native';
import { addContactHistory, updateNextContact } from './firestore';
import Constants from 'expo-constants';
import { notificationService } from './notifications';

const RNCallKeep = Constants.appOwnership === 'expo' ? null : require('react-native-callkeep').default;

export class CallHandler {
	constructor() {
		this.callKeep = RNCallKeep;
		this.initialized = false;
		this.activeCall = null;
	}

	async setup() {
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
		} catch (error) {}
	}

	setupEventListeners() {
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
			this.activeCall = {
				contact,
				startTime: new Date(),
				uuid: Constants.appOwnership === 'expo' ? 'expo-mock-uuid' : this.callKeep.getNewUUID(),
				type: callType,
			};

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
					Alert.alert('Call Error', error.message);
				}
				return false;
			}

			await Linking.openURL(urlScheme);

			if (Constants.appOwnership === 'expo') {
				setTimeout(() => {
					this.onCallEnded({ callUUID: 'expo-mock-uuid' });
				}, 1000);
			}

			return true;
		} catch (error) {
			this.activeCall = null;
			if (Constants.appOwnership !== 'expo') {
				Alert.alert('Call Error', error.message || 'Could not initiate call');
			}
			return false;
		}
	}

	onMuteCall = ({ muted, callUUID }) => {};

	onAnswerCall = ({ callUUID }) => {};

	onCallEnded = async ({ callUUID }) => {
		if (!this.activeCall || this.activeCall.uuid !== callUUID) return;

		try {
			const contact = this.activeCall.contact;
			const callEndTime = new Date();
			const callDuration = (callEndTime.getTime() - this.activeCall.startTime.getTime()) / 1000;

			if (callDuration > 10) {
				const nextContactDate = new Date();
				nextContactDate.setHours(nextContactDate.getHours() + 1);

				const historyEntry = await addContactHistory(contact.id, {
					date: callEndTime.toISOString(),
					notes: `(${this.activeCall.type} call completed - Add your notes)`,
					completed: false,
				});

				await updateNextContact(contact.id, nextContactDate, {
					lastContacted: true,
				});

				const followUpResult = await notificationService.scheduleFollowUpReminder(
					{
						...contact,
						notes: 'Add notes about your recent call',
						history: historyEntry,
						callData: {
							duration: callDuration,
							type: this.activeCall.type,
							endTime: callEndTime,
						},
					},
					callEndTime,
					contact.user_id
				);
			}
		} catch (error) {
			throw error;
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
		if (this.activeCall && this.activeCall.timeoutId) {
			clearTimeout(this.activeCall.timeoutId);
		}
		this.initialized = false;
		this.activeCall = null;
	}
}

export const callHandler = new CallHandler();
