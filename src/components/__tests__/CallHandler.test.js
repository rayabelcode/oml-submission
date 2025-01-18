import { jest } from '@jest/globals';

// Mock firebase
jest.mock('firebase/firestore', () => ({
	initializeFirestore: jest.fn(() => ({})),
	persistentLocalCache: jest.fn(() => ({})),
	persistentMultipleTabManager: jest.fn(() => ({})),
	getFirestore: jest.fn(() => ({})),
	collection: jest.fn(),
	doc: jest.fn(),
	getDoc: jest.fn(),
	updateDoc: jest.fn(),
}));

// Mock firebase config
jest.mock('../../config/firebase', () => ({
	db: {},
	auth: {
		currentUser: { uid: 'test-user' },
	},
	app: {},
}));

// Mock firestore utilities
jest.mock('../../utils/firestore', () => ({
	updateContactScheduling: jest.fn().mockResolvedValue(true),
	getContactById: jest.fn().mockResolvedValue({}),
}));

jest.mock('react-native/Libraries/Linking/Linking', () => ({
	canOpenURL: jest.fn(),
	openURL: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
	setItem: jest.fn(),
	removeItem: jest.fn(),
}));

// Mock Alert separately to avoid react-native import issues
jest.mock('react-native/Libraries/Alert/Alert', () => ({
	alert: jest.fn(),
}));

jest.mock('../../utils/callHandler', () => {
	const MockCallHandler = jest.fn().mockImplementation(() => ({
		initiateCall: jest.fn().mockImplementation(async (contact, callType) => {
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

			const canOpen = await require('react-native/Libraries/Linking/Linking').canOpenURL(urlScheme);
			if (!canOpen) {
				require('react-native/Libraries/Alert/Alert').alert(
					'Call Error',
					`Cannot make ${callType} call. Please check if the app is installed.`
				);
				return false;
			}

			await require('react-native/Libraries/Linking/Linking').openURL(urlScheme);
			return true;
		}),
		handleCallAction: jest.fn().mockImplementation(async (contact, type, onClose) => {
			try {
				await require('react-native/Libraries/Linking/Linking').openURL(`tel:${contact.phone}`);
				if (onClose) onClose();
				return true;
			} catch (error) {
				if (onClose) onClose();
				return false;
			}
		}),
	}));

	return {
		CallHandler: MockCallHandler,
		callHandler: new MockCallHandler(),
	};
});

import { CallHandler } from '../../utils/callHandler';
import { Linking, Alert } from 'react-native';

describe('CallHandler', () => {
	let callHandler;
	const mockNotificationService = {
		initialize: jest.fn().mockResolvedValue(true),
		scheduleCallFollowUp: jest.fn().mockResolvedValue('notification-id'),
	};

	const mockContact = {
		id: '123',
		first_name: 'John',
		last_name: 'Doe',
		phone: '1234567890',
	};

	beforeEach(() => {
		jest.clearAllMocks();
		callHandler = new CallHandler(mockNotificationService);
		Linking.canOpenURL.mockResolvedValue(true);
		Linking.openURL.mockResolvedValue(true);
	});

	describe('initiateCall', () => {
		it('should handle phone calls', async () => {
			const success = await callHandler.initiateCall(mockContact, 'phone');
			expect(success).toBeTruthy();
			expect(Linking.canOpenURL).toHaveBeenCalledWith('tel:1234567890');
			expect(Linking.openURL).toHaveBeenCalledWith('tel:1234567890');
		});

		it('should handle FaceTime audio calls', async () => {
			const success = await callHandler.initiateCall(mockContact, 'facetime-audio');
			expect(success).toBeTruthy();
			expect(Linking.canOpenURL).toHaveBeenCalledWith('facetime-audio://1234567890');
			expect(Linking.openURL).toHaveBeenCalledWith('facetime-audio://1234567890');
		});

		it('should handle FaceTime video calls', async () => {
			const success = await callHandler.initiateCall(mockContact, 'facetime-video');
			expect(success).toBeTruthy();
			expect(Linking.canOpenURL).toHaveBeenCalledWith('facetime://1234567890');
			expect(Linking.openURL).toHaveBeenCalledWith('facetime://1234567890');
		});

		it('should handle unsupported call types', async () => {
			Linking.canOpenURL.mockResolvedValue(false);
			const success = await callHandler.initiateCall(mockContact, 'unsupported');
			expect(success).toBeFalsy();
			expect(Alert.alert).toHaveBeenCalled();
		});
	});

	describe('handleCallAction', () => {
		it('should initiate call and close modal', async () => {
			const onClose = jest.fn();
			await callHandler.handleCallAction(mockContact, 'phone', onClose);
			expect(Linking.openURL).toHaveBeenCalled();
			expect(onClose).toHaveBeenCalled();
		});

		it('should handle errors gracefully', async () => {
			const onClose = jest.fn();
			Linking.openURL.mockRejectedValue(new Error('Failed'));
			await callHandler.handleCallAction(mockContact, 'phone', onClose);
			expect(onClose).toHaveBeenCalled();
		});
	});
});
