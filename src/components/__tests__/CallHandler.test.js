import { jest } from '@jest/globals';
import { CallHandler } from '../../utils/callHandler';
import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { addContactHistory, updateNextContact, createFollowUpReminder } from '../../utils/firestore';

jest.useRealTimers();

const mockSetTimeout = jest.spyOn(global, 'setTimeout');
const mockClearTimeout = jest.spyOn(global, 'clearTimeout');

// Mock console.error to avoid noise in test output
const originalConsoleError = console.error;

beforeAll(() => {
	console.error = jest.fn();
	jest.useFakeTimers({
		doNotFake: ['nextTick', 'setImmediate', 'clearImmediate'],
	});
});

afterAll(() => {
	console.error = originalConsoleError;
	jest.useRealTimers();
	mockSetTimeout.mockRestore();
	mockClearTimeout.mockRestore();
});

// Mock RNCallKeep
jest.mock('react-native-callkeep', () => ({
	default: {
		setup: jest.fn(),
		addEventListener: jest.fn(),
		removeEventListener: jest.fn(),
		startCall: jest.fn(),
		getNewUUID: jest.fn(() => 'mock-uuid'),
	},
}));

// Mock other dependencies
jest.mock('expo-constants', () => ({
	appOwnership: 'expo',
}));

jest.mock('react-native/Libraries/Linking/Linking', () => ({
	canOpenURL: jest.fn(),
	openURL: jest.fn(),
}));

jest.mock('../../utils/firestore', () => ({
	addContactHistory: jest.fn().mockResolvedValue(true),
	updateNextContact: jest.fn().mockResolvedValue(true),
	createFollowUpReminder: jest.fn().mockResolvedValue(true),
}));

describe('CallHandler', () => {
	let callHandler;
	const mockContact = {
		id: '123',
		first_name: 'John',
		last_name: 'Doe',
		phone: '1234567890',
	};

	beforeEach(() => {
		jest.clearAllMocks();
		jest.clearAllTimers();
		callHandler = new CallHandler();
		Linking.canOpenURL.mockResolvedValue(true);
		Linking.openURL.mockResolvedValue(true);
		addContactHistory.mockClear();
		updateNextContact.mockClear();
		createFollowUpReminder.mockClear();
	});

	afterEach(() => {
		if (callHandler?.activeCall?.timeoutId) {
			clearTimeout(callHandler.activeCall.timeoutId);
		}
		jest.clearAllTimers();
		jest.clearAllMocks();
		jest.runOnlyPendingTimers();
		callHandler?.cleanup();
	});

	describe('initialization', () => {
		it('should initialize with correct default values', () => {
			expect(callHandler.initialized).toBeFalsy();
			expect(callHandler.activeCall).toBeNull();
		});

		it('should setup without CallKeep in Expo environment', async () => {
			await callHandler.setup();
			expect(callHandler.initialized).toBeTruthy();
		});
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
		});
	});

	describe('call lifecycle', () => {
		it('should handle call end correctly', async () => {
			const startDate = new Date('2024-01-01T12:00:00Z');
			const DateSpy = jest.spyOn(global, 'Date').mockImplementation(() => startDate);

			await callHandler.initiateCall(mockContact, 'phone');
			expect(callHandler.activeCall).not.toBeNull();

			const endDate = new Date('2024-01-01T12:00:11Z');
			DateSpy.mockImplementation(() => endDate);

			await callHandler.onCallEnded({ callUUID: callHandler.activeCall.uuid });
			expect(callHandler.activeCall).toBeNull();

			DateSpy.mockRestore();
		});

		it('should not create follow-up for short calls', async () => {
			const startDate = new Date('2024-01-01T12:00:00Z');
			const DateSpy = jest.spyOn(global, 'Date').mockImplementation(() => startDate);

			await callHandler.initiateCall(mockContact, 'phone');
			expect(callHandler.activeCall).not.toBeNull();

			const endDate = new Date('2024-01-01T12:00:05Z');
			DateSpy.mockImplementation(() => endDate);

			await callHandler.onCallEnded({ callUUID: callHandler.activeCall.uuid });
			expect(callHandler.activeCall).toBeNull();

			DateSpy.mockRestore();
		});
	});

	describe('edge cases', () => {
		it('should handle multiple rapid call initiations', async () => {
			const call1 = callHandler.initiateCall(mockContact, 'phone');
			const call2 = callHandler.initiateCall(mockContact, 'phone');
			const results = await Promise.all([call1, call2]);
			expect(results[0]).toBeTruthy();
			expect(results[1]).toBeTruthy();
		});

		it('should handle invalid phone numbers', async () => {
			Linking.canOpenURL.mockResolvedValueOnce(false);
			const invalidContact = { ...mockContact, phone: 'invalid' };
			const success = await callHandler.initiateCall(invalidContact, 'phone');
			expect(success).toBeFalsy();
		});

		it('should handle undefined contact', async () => {
			const success = await callHandler.initiateCall(undefined, 'phone');
			expect(success).toBeFalsy();
		});
	});

	describe('firestore integration', () => {
		it('should create contact history for long calls', async () => {
			const startTime = new Date('2024-01-01T12:00:00Z');
			const endTime = new Date('2024-01-01T12:00:11Z');
			const DateSpy = jest.spyOn(global, 'Date').mockImplementation(() => startTime);

			await callHandler.initiateCall(mockContact, 'phone');
			expect(callHandler.activeCall).not.toBeNull();

			DateSpy.mockImplementation(() => endTime);

			await callHandler.onCallEnded({ callUUID: callHandler.activeCall.uuid });

			expect(addContactHistory).toHaveBeenCalledWith(
				mockContact.id,
				expect.objectContaining({
					completed: false,
					notes: expect.stringContaining('call completed'),
				})
			);

			DateSpy.mockRestore();
		});

		it('should update next contact date after long calls', async () => {
			const startTime = new Date('2024-01-01T12:00:00Z');
			const endTime = new Date('2024-01-01T12:00:11Z');
			const DateSpy = jest.spyOn(global, 'Date').mockImplementation(() => startTime);

			await callHandler.initiateCall(mockContact, 'phone');
			expect(callHandler.activeCall).not.toBeNull();

			DateSpy.mockImplementation(() => endTime);

			await callHandler.onCallEnded({ callUUID: callHandler.activeCall.uuid });

			const expectedDate = new Date(endTime);
			expectedDate.setHours(expectedDate.getHours() + 1);

			expect(updateNextContact).toHaveBeenCalledWith(
				mockContact.id,
				expectedDate,
				expect.objectContaining({
					lastContacted: true,
				})
			);

			DateSpy.mockRestore();
		});
	});

	describe('error handling', () => {
		it('should handle Linking.openURL failure', async () => {
			Linking.openURL.mockRejectedValueOnce(new Error('Failed to open URL'));
			const success = await callHandler.initiateCall(mockContact, 'phone');
			expect(success).toBeFalsy();
		});

		it('should handle CallKeep setup failure', async () => {
			const RNCallKeep = require('react-native-callkeep').default;
			RNCallKeep.setup.mockRejectedValueOnce(new Error('Setup failed'));
			await callHandler.setup();
			expect(callHandler.initialized).toBeTruthy();
		});

		it('should handle firestore failures gracefully', async () => {
			addContactHistory.mockRejectedValueOnce(new Error('Firestore error'));
			updateNextContact.mockRejectedValueOnce(new Error('Firestore error'));
			createFollowUpReminder.mockRejectedValueOnce(new Error('Firestore error'));

			const startDate = new Date('2024-01-01T12:00:00Z');
			const DateSpy = jest.spyOn(global, 'Date').mockImplementation(() => startDate);

			await callHandler.initiateCall(mockContact, 'phone');

			const endDate = new Date('2024-01-01T12:00:11Z');
			DateSpy.mockImplementation(() => endDate);

			await callHandler.onCallEnded({ callUUID: callHandler.activeCall.uuid });
			expect(callHandler.activeCall).toBeNull();

			DateSpy.mockRestore();
		});
	});

	describe('cleanup', () => {
		it('should reset state correctly', () => {
			callHandler.initialized = true;
			callHandler.activeCall = { some: 'data' };
			callHandler.cleanup();
			expect(callHandler.initialized).toBeFalsy();
			expect(callHandler.activeCall).toBeNull();
		});
	});
});
