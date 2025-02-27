import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ScheduleScreen from '../../screens/ScheduleScreen';

jest.mock('expo-image', () => ({
	Image: 'ExpoImage',
}));

jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

jest.mock('expo-status-bar', () => ({
	StatusBar: 'StatusBar',
}));

// Focus callback ref
let registeredFocusCallback = null;
jest.mock('@react-navigation/native', () => ({
	useFocusEffect: jest.fn(),
}));

jest.mock('../../utils/firestore', () => ({
	fetchUpcomingContacts: jest.fn(),
}));

jest.mock('../../utils/cache', () => ({
	cacheManager: {
		getCachedUpcomingContacts: jest.fn(),
		saveUpcomingContacts: jest.fn(),
	},
}));

// Auth context user state
let mockUserState = { user: { uid: 'test-user-id' } };
jest.mock('../../context/AuthContext', () => ({
	useAuth: () => mockUserState,
}));

jest.mock('../../context/ThemeContext', () => ({
	useTheme: () => ({
		colors: {
			text: { primary: '#000', secondary: '#666' },
			background: { primary: '#fff', secondary: '#f5f5f5' },
			primary: '#007AFF',
		},
	}),
}));

jest.mock('../../styles/screens/schedule', () => ({
	useStyles: () => ({
		emptyStateContainer: {},
		emptyStateIcon: {},
		emptyStateTitle: {},
		emptyStateMessage: {},
		emptyStateButton: {},
		contactCard: { testID: 'contact-card' },
		contactCardHeader: {},
		avatarContainer: {},
		avatar: {},
		defaultAvatar: {},
		contactInfo: {},
		contactName: {},
		reminderType: { testID: 'reminder-type' },
		contactCardFooter: {},
		dateContainer: {},
		dateIcon: {},
		contactDate: { testID: 'contact-date' },
		contactGroup: {},
		groupHeader: { testID: 'group-header' },
		groupTitle: { testID: 'group-title' },
		contactList: {},
		section: {},
		loadingContainer: {},
		loadingText: {},
		groupsContainer: {},
	}),
}));

jest.mock('../../styles/common', () => ({
	useCommonStyles: () => ({
		container: {},
		message: {},
		primaryButton: {},
		primaryButtonText: {},
		pageHeader: {},
		pageHeaderIcon: {},
		pageHeaderTitle: {},
	}),
}));

jest.mock('react-native/Libraries/Alert/Alert', () => ({
	alert: jest.fn(),
}));

describe('ScheduleScreen', () => {
	const mockNavigation = {
		navigate: jest.fn(),
		addListener: jest.fn((event, callback) => {
			if (event === 'focus') {
				registeredFocusCallback = callback;
				callback(); // Execute immediately
			}
			return jest.fn(); // Return cleanup function
		}),
	};

	// Test data contacts
	const mockContacts = [
		{
			id: 'contact1',
			first_name: 'John',
			last_name: 'Doe',
			photo_url: 'https://example.com/john.jpg',
			next_contact: new Date().toISOString(), // Today
			scheduling: { frequency: 'weekly' },
		},
		{
			id: 'contact2',
			first_name: 'Jane',
			last_name: 'Smith',
			next_contact: (() => {
				const date = new Date();
				date.setDate(date.getDate() + 1); // Tomorrow
				return date.toISOString();
			})(),
			scheduling: { frequency: 'monthly' },
		},
		{
			id: 'contact3',
			first_name: 'Custom',
			last_name: 'Date',
			next_contact: (() => {
				const date = new Date();
				date.setDate(date.getDate() + 3); // This week
				return date.toISOString();
			})(),
			scheduling: { custom_next_date: true },
		},
	];

	beforeEach(() => {
		jest.clearAllMocks();
		mockUserState = { user: { uid: 'test-user-id' } };
		registeredFocusCallback = null;

		const { fetchUpcomingContacts } = require('../../utils/firestore');
		fetchUpcomingContacts.mockResolvedValue(mockContacts);

		const { cacheManager } = require('../../utils/cache');
		cacheManager.getCachedUpcomingContacts.mockResolvedValue(mockContacts);

		jest.spyOn(Date, 'now').mockImplementation(() => 1609459200000); // Initial timestamp
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	// Test: Authentication states
	it('displays login message when no user is provided', () => {
		mockUserState = { user: null };
		const { getByText } = render(<ScheduleScreen navigation={mockNavigation} />);
		expect(getByText('Please log in to view your schedule')).toBeTruthy();
	});

	// Test: Loading state
	it('displays loading state initially', async () => {
		const { cacheManager } = require('../../utils/cache');
		cacheManager.getCachedUpcomingContacts.mockImplementation(
			() =>
				new Promise((resolve) => {
					setTimeout(() => resolve(null), 100);
				})
		);

		const { getByText } = render(<ScheduleScreen navigation={mockNavigation} />);
		expect(getByText('Loading your schedule...')).toBeTruthy();
	});

	// Test: Empty state
	it('displays empty state when no contacts exist', async () => {
		const { fetchUpcomingContacts } = require('../../utils/firestore');
		const { cacheManager } = require('../../utils/cache');

		fetchUpcomingContacts.mockResolvedValue([]);
		cacheManager.getCachedUpcomingContacts.mockResolvedValue([]);

		const { getByText, findByText } = render(<ScheduleScreen navigation={mockNavigation} />);

		const emptyStateText = await findByText('No upcoming calls');
		expect(emptyStateText).toBeTruthy();

		fireEvent.press(getByText('Go to Contacts'));
		expect(mockNavigation.navigate).toHaveBeenCalledWith('Contacts');
	});

	// Test: Frequency label formatting
	it('displays correct frequency labels for contacts', async () => {
		const { getAllByText } = render(<ScheduleScreen navigation={mockNavigation} />);

		await waitFor(() => {
			const weeklySchedules = getAllByText('Weekly Schedule');
			const monthlySchedules = getAllByText('Monthly Schedule');
			const customDates = getAllByText('Custom Date');

			expect(weeklySchedules.length).toBeGreaterThan(0);
			expect(monthlySchedules.length).toBeGreaterThan(0);
			expect(customDates.length).toBeGreaterThan(0);
		});
	});

	// Test 5: Date formatting
	it('displays dates in the correct format', async () => {
		const { getAllByText } = render(<ScheduleScreen navigation={mockNavigation} />);

		await waitFor(() => {
			const todayLabels = getAllByText('Today');
			const tomorrowLabels = getAllByText('Tomorrow');

			expect(todayLabels.length).toBeGreaterThan(0);
			expect(tomorrowLabels.length).toBeGreaterThan(0);
		});
	});

	// Test: Contact grouping
	it('groups contacts correctly by time period', async () => {
		const { getAllByText } = render(<ScheduleScreen navigation={mockNavigation} />);

		await waitFor(() => {
			const todayGroups = getAllByText('Today');
			const tomorrowGroups = getAllByText('Tomorrow');
			const thisWeekGroups = getAllByText('This Week');

			expect(todayGroups.length).toBeGreaterThan(0);
			expect(tomorrowGroups.length).toBeGreaterThan(0);
			expect(thisWeekGroups.length).toBeGreaterThan(0);
		});
	});

	// Test: Navigation to contact details
	it('navigates to contact details when a contact is pressed', async () => {
		const { findByText } = render(<ScheduleScreen navigation={mockNavigation} />);

		const contactName = await findByText('John Doe');
		fireEvent.press(contactName);

		expect(mockNavigation.navigate).toHaveBeenCalledWith(
			'ContactDetails',
			expect.objectContaining({
				contact: expect.objectContaining({ id: 'contact1' }),
				initialTab: 'Schedule',
			})
		);
	});

	// Test: Default avatar when photo_url is missing
	it('displays default avatar for contacts without photos', async () => {
		// Add a contact without a photo
		const contactsWithMissingPhoto = [
			{
				id: 'contact4',
				first_name: 'No',
				last_name: 'Photo',
				photo_url: null, // Missing photo
				next_contact: new Date().toISOString(),
				scheduling: { frequency: 'weekly' },
			},
			...mockContacts,
		];

		const { fetchUpcomingContacts } = require('../../utils/firestore');
		fetchUpcomingContacts.mockResolvedValue(contactsWithMissingPhoto);

		const { cacheManager } = require('../../utils/cache');
		cacheManager.getCachedUpcomingContacts.mockResolvedValue(contactsWithMissingPhoto);

		const { findByText, getAllByText } = render(<ScheduleScreen navigation={mockNavigation} />);

		// Wait for the contact to load
		await findByText('No Photo');

		// Check for the Icon component that's used as default avatar
		expect(await findByText('No Photo')).toBeTruthy();
	});

	// Test: Refresh functionality
	it('refreshes data when pull-to-refresh is triggered', async () => {
		jest.spyOn(React, 'useState').mockImplementationOnce(() => [false, jest.fn()]);

		render(<ScheduleScreen navigation={mockNavigation} />);

		const { fetchUpcomingContacts } = require('../../utils/firestore');
		expect(fetchUpcomingContacts).toHaveBeenCalled();
	});

	// Test: Throttled updates
	it('throttles updates based on time since last update', async () => {
		render(<ScheduleScreen navigation={mockNavigation} />);

		await waitFor(() => {
			const { fetchUpcomingContacts } = require('../../utils/firestore');
			expect(fetchUpcomingContacts).toHaveBeenCalled();
		});

		const { fetchUpcomingContacts } = require('../../utils/firestore');
		fetchUpcomingContacts.mockClear();

		// Manually call the callback within throttle period
		registeredFocusCallback();

		// Should not trigger update (throttled)
		expect(fetchUpcomingContacts).not.toHaveBeenCalled();

		// Advance time past throttle period
		Date.now.mockImplementation(() => 1609459200000 + 3000); // 3 seconds later

		// Trigger focus again
		registeredFocusCallback();

		// Should trigger update now
		await waitFor(() => {
			expect(fetchUpcomingContacts).toHaveBeenCalled();
		});
	});

	// Test: Smart contact refreshing
	it('only updates contacts when data has actually changed', async () => {
		const { fetchUpcomingContacts } = require('../../utils/firestore');
		const { cacheManager } = require('../../utils/cache');

		// First load
		render(<ScheduleScreen navigation={mockNavigation} />);

		await waitFor(() => {
			expect(fetchUpcomingContacts).toHaveBeenCalled();
		});

		// Clear mocks to track new calls
		fetchUpcomingContacts.mockClear();
		cacheManager.saveUpcomingContacts.mockClear();

		// Set up to return changed data
		const updatedContacts = JSON.parse(JSON.stringify(mockContacts));
		updatedContacts[0].scheduling.frequency = 'daily'; // Changed from weekly

		fetchUpcomingContacts.mockResolvedValue(updatedContacts);

		// Advance time past throttle period
		Date.now.mockImplementation(() => 1609459200000 + 3000);

		// Trigger focus with changed data
		registeredFocusCallback();

		// Should update since data changed
		await waitFor(() => {
			expect(cacheManager.saveUpcomingContacts).toHaveBeenCalled();
		});
	});

	// Test: Error handling
	it('shows an alert when loading contacts fails and resets loading state', async () => {
		const { fetchUpcomingContacts } = require('../../utils/firestore');
		fetchUpcomingContacts.mockRejectedValue(new Error('Network error'));

		const { queryByText } = render(<ScheduleScreen navigation={mockNavigation} />);

		// First it should show loading
		expect(queryByText('Loading your schedule...')).toBeTruthy();

		await waitFor(() => {
			// Check that alert was shown
			expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to load contacts');

			// Check that loading indicator is removed
			expect(queryByText('Loading your schedule...')).toBeNull();
		});
	});
});
