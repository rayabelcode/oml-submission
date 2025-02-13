import * as Contacts from 'expo-contacts';
import { uploadContactPhoto, checkForExistingContact } from '../../utils/firestore';
import { createContactData } from '../../utils/contactHelpers';
import { Alert } from 'react-native';

import {
    RELATIONSHIP_TYPES,
    RELATIONSHIP_DEFAULTS,
    DEFAULT_RELATIONSHIP_TYPE,
} from '../../../constants/relationships';

jest.mock('../../../constants/relationships', () => ({
	RELATIONSHIP_TYPES: {
		friend: 'Friend',
		family: 'Family',
		work: 'Work',
	},
	RELATIONSHIP_DEFAULTS: {
		preferred_days: {
			friend: ['monday', 'wednesday', 'friday'],
			family: ['saturday', 'sunday'],
			work: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
		},
		active_hours: {
			friend: { start: '09:00', end: '17:00' },
			family: { start: '10:00', end: '20:00' },
			work: { start: '09:00', end: '17:00' },
		},
		excluded_times: {
			friend: [],
			family: [],
			work: [],
		},
	},
	DEFAULT_RELATIONSHIP_TYPE: 'friend',
}));

jest.mock('expo-contacts', () => ({
	requestPermissionsAsync: jest.fn(),
	getContactByIdAsync: jest.fn(),
	presentContactPickerAsync: jest.fn(),
	Fields: {
		FirstName: 'firstName',
		LastName: 'lastName',
		PhoneNumbers: 'phoneNumbers',
		Emails: 'emails',
		Birthday: 'birthday',
		Image: 'image',
	},
}));

jest.mock('../../utils/firestore', () => ({
	uploadContactPhoto: jest.fn(),
	checkForExistingContact: jest.fn(),
	addContact: jest.fn(),
	updateContactScheduling: jest.fn(),
}));

jest.mock('react-native/Libraries/Alert/Alert', () => ({
	alert: jest.fn(),
}));

// Function to format phone numbers
function formatPhoneNumber(phone) {
	// Remove all non-numeric characters
	const cleaned = phone.replace(/\D/g, '');

	// Handle different formats
	if (cleaned.length === 10) {
		return `+1${cleaned}`; // US number without country code
	} else if (cleaned.length === 11 && cleaned.startsWith('1')) {
		return `+${cleaned}`; // US number with country code
	} else if (cleaned.startsWith('44')) {
		return `+${cleaned}`; // UK number
	}

	// For other international numbers, just add + if not present
	return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

describe('Contact Import', () => {
	const mockUserId = 'test-user';
	const mockContact = {
		id: 'test-contact',
		firstName: 'John',
		lastName: 'Doe',
		phoneNumbers: [{ number: '1234567890' }],
		emails: [{ email: 'john@example.com' }],
		birthday: { month: 0, day: 4 }, // January 4
		image: { uri: 'test-uri' },
	};

	beforeEach(() => {
		jest.clearAllMocks();
		Contacts.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
		Contacts.getContactByIdAsync.mockResolvedValue(mockContact);
		Contacts.presentContactPickerAsync.mockResolvedValue({ id: mockContact.id });
		uploadContactPhoto.mockResolvedValue('uploaded-photo-url');
		checkForExistingContact.mockResolvedValue(false);
	});

	describe('Permission Handling', () => {
		it('should throw error when permissions are denied', async () => {
			Contacts.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });

			const handleImportContacts = async () => {
				const { status } = await Contacts.requestPermissionsAsync();
				if (status !== 'granted') {
					throw new Error('Permission denied');
				}
			};

			await expect(handleImportContacts()).rejects.toThrow('Permission denied');
		});

		it('should not proceed with import when permissions are denied', async () => {
			Contacts.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });
			const result = await handleContactSelection(mockContact.id);
			expect(result).toBeNull();
			expect(Contacts.getContactByIdAsync).not.toHaveBeenCalled();
		});
	});

	describe('Contact Selection', () => {
		it('should handle contact picker cancellation', async () => {
			Contacts.presentContactPickerAsync.mockResolvedValue(null);
			const result = await handleContactImport();
			expect(result).toBeNull();
			expect(Contacts.getContactByIdAsync).not.toHaveBeenCalled();
		});

		it('should validate required contact fields', async () => {
			const invalidContact = { ...mockContact, phoneNumbers: [] };
			Contacts.getContactByIdAsync.mockResolvedValue(invalidContact);
			const result = await handleContactSelection(invalidContact.id);
			expect(result).toBeNull();
			expect(Alert.alert).toHaveBeenCalledWith(
				'Invalid Contact',
				'Selected contact must have a phone number'
			);
		});
	});

	describe('Photo Handling', () => {
		it('should handle successful photo upload', async () => {
			uploadContactPhoto.mockResolvedValue('uploaded-photo-url');
			const result = await handleContactSelection(mockContact.id, mockUserId);
			expect(uploadContactPhoto).toHaveBeenCalledWith(mockUserId, mockContact.image.uri);
			expect(result.photo_url).toBe('uploaded-photo-url');
		});

		it('should handle photo upload failure gracefully', async () => {
			uploadContactPhoto.mockRejectedValue(new Error('Upload failed'));
			const result = await handleContactSelection(mockContact.id, mockUserId);
			expect(result.photo_url).toBeNull();
			expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to upload photo');
		});

		it('should handle contact without photo', async () => {
			const contactWithoutPhoto = { ...mockContact, image: null };
			Contacts.getContactByIdAsync.mockResolvedValue(contactWithoutPhoto);
			const result = await handleContactSelection(contactWithoutPhoto.id, mockUserId);
			expect(uploadContactPhoto).not.toHaveBeenCalled();
			expect(result.photo_url).toBeNull();
		});
	});

	describe('Birthday Handling', () => {
		it('should format valid birthday correctly', async () => {
			const result = await handleContactSelection(mockContact.id);
			expect(result.birthday).toBe('01-04');
		});

		it('should handle missing birthday', async () => {
			const contactWithoutBirthday = { ...mockContact, birthday: null };
			Contacts.getContactByIdAsync.mockResolvedValue(contactWithoutBirthday);
			const result = await handleContactSelection(contactWithoutBirthday.id);
			expect(result.birthday).toBeNull();
		});

		it('should handle invalid birthday data', async () => {
			const contactWithInvalidBirthday = {
				...mockContact,
				birthday: { month: 13, day: 32 },
			};
			Contacts.getContactByIdAsync.mockResolvedValue(contactWithInvalidBirthday);
			const result = await handleContactSelection(contactWithInvalidBirthday.id);
			expect(result.birthday).toBeNull();
		});
	});

	describe('Duplicate Handling', () => {
		it('should detect duplicate phone numbers', async () => {
			checkForExistingContact.mockResolvedValue(true);
			const result = await handleContactSelection(mockContact.id);
			expect(result).toBeNull();
			expect(Alert.alert).toHaveBeenCalledWith(
				'Duplicate Contact',
				'This contact already exists in your list.'
			);
		});
	});

	describe('Phone Number Formatting', () => {
		it('should handle US phone number formats', async () => {
			const phoneFormats = [
				{ input: '1234567890', expected: '+11234567890' }, // 10 digits
				{ input: '123.456.7890', expected: '+11234567890' }, // 10 digits with punctuation
				{ input: '123-456-7890', expected: '+11234567890' }, // 10 digits with dashes
			];

			for (const format of phoneFormats) {
				const contactWithPhone = {
					...mockContact,
					phoneNumbers: [{ number: format.input }],
				};
				Contacts.getContactByIdAsync.mockResolvedValue(contactWithPhone);
				const result = await handleContactSelection(contactWithPhone.id, mockUserId);
				expect(result.phone).toBe(format.expected);
			}
		});

		it('should handle phone numbers with country code', async () => {
			const contactWithCountryCode = {
				...mockContact,
				phoneNumbers: [{ number: '11234567890' }],
			};
			Contacts.getContactByIdAsync.mockResolvedValue(contactWithCountryCode);
			const result = await handleContactSelection(contactWithCountryCode.id, mockUserId);
			expect(result.phone).toBe('+11234567890');
		});

		it('should handle international numbers', async () => {
			const contactWithIntl = {
				...mockContact,
				phoneNumbers: [{ number: '441234567890' }],
			};
			Contacts.getContactByIdAsync.mockResolvedValue(contactWithIntl);
			const result = await handleContactSelection(contactWithIntl.id, mockUserId);
			expect(result.phone).toBe('+441234567890');
		});

		it('should use first phone number when multiple exist', async () => {
			const contactWithMultiplePhones = {
				...mockContact,
				phoneNumbers: [
					{ number: '1234567890', label: 'mobile' },
					{ number: '0987654321', label: 'home' },
				],
			};
			Contacts.getContactByIdAsync.mockResolvedValue(contactWithMultiplePhones);
			const result = await handleContactSelection(contactWithMultiplePhones.id, mockUserId);
			expect(result.phone).toBe('+11234567890');
		});
	});

	describe('Name Handling', () => {
		it('should handle missing names', async () => {
			const testCases = [
				{ firstName: null, lastName: 'Doe', expectedFirst: '', expectedLast: 'Doe' },
				{ firstName: 'John', lastName: null, expectedFirst: 'John', expectedLast: '' },
				{ firstName: null, lastName: null, expectedFirst: '', expectedLast: '' },
			];

			for (const testCase of testCases) {
				const contactWithMissingName = {
					...mockContact,
					firstName: testCase.firstName,
					lastName: testCase.lastName,
				};
				Contacts.getContactByIdAsync.mockResolvedValue(contactWithMissingName);
				const result = await handleContactSelection(contactWithMissingName.id, mockUserId);
				expect(result.first_name).toBe(testCase.expectedFirst);
				expect(result.last_name).toBe(testCase.expectedLast);
			}
		});

		it('should handle special characters in names', async () => {
			const contactWithSpecialChars = {
				...mockContact,
				firstName: 'María-José',
				lastName: "O'Connor",
			};
			Contacts.getContactByIdAsync.mockResolvedValue(contactWithSpecialChars);
			const result = await handleContactSelection(contactWithSpecialChars.id, mockUserId);
			expect(result.first_name).toBe('María-José');
			expect(result.last_name).toBe("O'Connor");
		});
	});

	describe('Email Handling', () => {
		it('should handle missing email', async () => {
			const contactWithoutEmail = {
				...mockContact,
				emails: null,
			};
			Contacts.getContactByIdAsync.mockResolvedValue(contactWithoutEmail);
			const result = await handleContactSelection(contactWithoutEmail.id, mockUserId);
			expect(result.email).toBe('');
		});

		it('should use first email when multiple exist', async () => {
			const contactWithMultipleEmails = {
				...mockContact,
				emails: [{ email: 'primary@example.com' }, { email: 'secondary@example.com' }],
			};
			Contacts.getContactByIdAsync.mockResolvedValue(contactWithMultipleEmails);
			const result = await handleContactSelection(contactWithMultipleEmails.id, mockUserId);
			expect(result.email).toBe('primary@example.com');
		});
	});

	describe('Error Handling', () => {
		it('should handle contact fetch failure', async () => {
			Contacts.getContactByIdAsync.mockRejectedValue(new Error('Failed to fetch contact'));
			const result = await handleContactSelection(mockContact.id, mockUserId);
			expect(result).toBeNull();
			expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to import contact: Failed to fetch contact');
		});

		it('should handle malformed contact data', async () => {
			const malformedContact = {
				id: 'test-contact',
				// Missing all other fields
			};
			Contacts.getContactByIdAsync.mockResolvedValue(malformedContact);
			const result = await handleContactSelection(malformedContact.id, mockUserId);
			expect(result).toBeNull();
			expect(Alert.alert).toHaveBeenCalledWith(
				'Invalid Contact',
				'Selected contact must have a phone number'
			);
		});
	});
});

// Helper function to simulate the full contact import flow
async function handleContactImport(userId) {
	const { status } = await Contacts.requestPermissionsAsync();
	if (status !== 'granted') {
		Alert.alert('Permission Denied', 'Please enable contact access in your settings to import contacts.');
		return null;
	}

	const pickerResult = await Contacts.presentContactPickerAsync();
	if (!pickerResult) {
		return null;
	}

	return handleContactSelection(pickerResult.id, userId);
}

// Helper function to handle contact selection and processing
async function handleContactSelection(contactId, userId) {
	try {
		const { status } = await Contacts.requestPermissionsAsync();
		if (status !== 'granted') {
			Alert.alert('Permission Denied', 'Please enable contact access in your settings to import contacts.');
			return null;
		}

		const contact = await Contacts.getContactByIdAsync(contactId);

		if (!contact.phoneNumbers?.length) {
			Alert.alert('Invalid Contact', 'Selected contact must have a phone number');
			return null;
		}

		const phoneNumber = contact.phoneNumbers[0].number;
		const formattedPhone = formatPhoneNumber(phoneNumber);

		const isDuplicate = await checkForExistingContact(formattedPhone);
		if (isDuplicate) {
			Alert.alert('Duplicate Contact', 'This contact already exists in your list.');
			return null;
		}

		let photoUrl = null;
		if (contact.image?.uri) {
			try {
				photoUrl = await uploadContactPhoto(userId, contact.image.uri);
			} catch (error) {
				Alert.alert('Error', 'Failed to upload photo');
			}
		}

		const birthday =
			contact.birthday &&
			contact.birthday.month >= 0 &&
			contact.birthday.month < 12 &&
			contact.birthday.day > 0 &&
			contact.birthday.day <= 31
				? `${String(contact.birthday.month + 1).padStart(2, '0')}-${String(contact.birthday.day).padStart(
						2,
						'0'
				  )}`
				: null;

		return {
			first_name: contact.firstName || '',
			last_name: contact.lastName || '',
			phone: formattedPhone,
			email: contact.emails?.[0]?.email || '',
			photo_url: photoUrl,
			birthday,
		};
	} catch (error) {
		Alert.alert('Error', 'Failed to import contact: ' + error.message);
		return null;
	}
}

// New scheduling structure
describe('Contact Data Structure', () => {
	it('should create contact with correct scheduling defaults', async () => {
		const basicData = {
			first_name: 'John',
			last_name: 'Doe',
			phone: '1234567890',
			relationship_type: 'friend',
		};

		const result = createContactData(basicData, 'test-user');

		expect(result.scheduling).toMatchObject({
			relationship_type: 'friend',
			frequency: 'weekly',
			custom_schedule: true, // Verify new default
			priority: 'normal',
			minimum_gap: 30,
			custom_preferences: expect.any(Object),
			recurring_next_date: null,
			custom_next_date: null,
			pattern_adjusted: false,
			confidence: null,
			snooze_count: { increment: 0 },
			scheduling_status: {
				wasRescheduled: false,
				wasSnooze: false,
			},
			status: null,
		});
	});

	it('should handle relationship type defaults correctly', async () => {
		const basicData = {
			first_name: 'John',
			last_name: 'Doe',
			phone: '1234567890',
			// No relationship_type provided
		};

		const result = createContactData(basicData, 'test-user');

		expect(result.scheduling.relationship_type).toBe(DEFAULT_RELATIONSHIP_TYPE);
		expect(result.scheduling.custom_preferences).toMatchObject({
			preferred_days: RELATIONSHIP_DEFAULTS.preferred_days[DEFAULT_RELATIONSHIP_TYPE],
			active_hours: RELATIONSHIP_DEFAULTS.active_hours[DEFAULT_RELATIONSHIP_TYPE],
			excluded_times: RELATIONSHIP_DEFAULTS.excluded_times[DEFAULT_RELATIONSHIP_TYPE],
		});
	});
});
