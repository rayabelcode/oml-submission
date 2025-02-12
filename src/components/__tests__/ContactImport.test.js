import * as Contacts from 'expo-contacts';
import { uploadContactPhoto, checkForExistingContact } from '../../utils/firestore';
import { createContactData } from '../../utils/contactHelpers';
import { Alert } from 'react-native';

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
		const isDuplicate = await checkForExistingContact(phoneNumber);
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
			phone: contact.phoneNumbers[0].number,
			email: contact.emails?.[0]?.email || '',
			photo_url: photoUrl,
			birthday,
		};
	} catch (error) {
		Alert.alert('Error', 'Failed to import contact: ' + error.message);
		return null;
	}
}
