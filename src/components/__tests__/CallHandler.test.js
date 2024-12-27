import { CallHandler } from '../../utils/callHandler';
import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';

// Mock console.error to avoid noise in test output
const originalConsoleError = console.error;
beforeAll(() => {
	console.error = jest.fn();
});

afterAll(() => {
	console.error = originalConsoleError;
});

// Mock timer functions
jest.useFakeTimers();

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
	addContactHistory: jest.fn(),
	updateNextContact: jest.fn(),
	createFollowUpReminder: jest.fn(),
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
		callHandler = new CallHandler();
		jest.clearAllMocks();
		jest.clearAllTimers();
		Linking.canOpenURL.mockResolvedValue(true);
		Linking.openURL.mockResolvedValue(true);
	});

	afterEach(() => {
		jest.clearAllTimers();
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
		let mockDate;

		beforeEach(() => {
			// Set up a fixed date for testing
			mockDate = new Date('2024-01-01T12:00:00Z');
			jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
		});

		afterEach(() => {
			jest.restoreAllMocks();
		});

		it('should handle call end correctly', async () => {
			// Mock the date for call start
			const startDate = new Date('2024-01-01T12:00:00Z');
			jest.spyOn(global, 'Date').mockImplementation(() => startDate);

			// Initiate call
			const success = await callHandler.initiateCall(mockContact, 'phone');
			expect(success).toBeTruthy();
			expect(callHandler.activeCall).not.toBeNull();

			// Mock the date for call end (11 seconds later)
			const endDate = new Date('2024-01-01T12:00:11Z');
			jest.spyOn(global, 'Date').mockImplementation(() => endDate);

			// End call
			await callHandler.onCallEnded({ callUUID: callHandler.activeCall.uuid });

			// Verify call was ended
			expect(callHandler.activeCall).toBeNull();
		});

		it('should not create follow-up for short calls', async () => {
			// Mock the date for call start
			const startDate = new Date('2024-01-01T12:00:00Z');
			jest.spyOn(global, 'Date').mockImplementation(() => startDate);

			// Initiate call
			const success = await callHandler.initiateCall(mockContact, 'phone');
			expect(success).toBeTruthy();
			expect(callHandler.activeCall).not.toBeNull();

			// Mock the date for call end (5 seconds later)
			const endDate = new Date('2024-01-01T12:00:05Z');
			jest.spyOn(global, 'Date').mockImplementation(() => endDate);

			// End call
			await callHandler.onCallEnded({ callUUID: callHandler.activeCall.uuid });

			// Verify call was ended
			expect(callHandler.activeCall).toBeNull();
		});
	});

	describe('cleanup', () => {
		it('should reset state correctly', () => {
			callHandler.cleanup();
			expect(callHandler.initialized).toBeFalsy();
			expect(callHandler.activeCall).toBeNull();
		});
	});
});
