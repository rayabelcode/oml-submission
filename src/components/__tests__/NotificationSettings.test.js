import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'react-native/Libraries/Linking/Linking';
import NotificationSettingsScreen from '../../screens/settings/NotificationSettingsScreen';

// Mock Firebase config
jest.mock('../../config/firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'test-user' } },
    initializeFirestore: jest.fn(),
    persistentLocalCache: jest.fn(),
    persistentMultipleTabManager: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
    initializeFirestore: jest.fn(),
    persistentLocalCache: jest.fn(),
    persistentMultipleTabManager: jest.fn(),
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
}));

// Mock expo-font
jest.mock('expo-font', () => ({
    isLoaded: jest.fn(() => true),
    loadAsync: jest.fn(),
    __internal__: {
        nativeFonts: [],
    },
}));

// Mock Icon component
jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Icon',
}));

// Mock vector icons
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

// Mock settings
jest.mock('../../styles/screens/settings', () => ({
    useStyles: () => ({
        container: {},
        headerSettingsPages: {},
        settingSection: {},
        sectionTitle: {},
        sectionDescription: {},
        settingItem: {},
        settingItemLeft: {},
        settingText: {},
        profileName: {},
        profileSectionContainer: {},
        profileSection: {},
        iconTitleContainer: {},
        notificationTitle: {},
        sectionHeader: {},
        sectionIcon: {},
    }),
}));

// Mock ThemeContext
jest.mock('../../context/ThemeContext', () => {
    const theme = {
        colors: {
            text: { primary: '#000' },
            background: { primary: '#fff', secondary: '#f2f2f2' },
            primary: '#007AFF',
            border: '#E5E5EA',
        },
        layout: {
            borderRadius: {
                sm: 8,
                md: 10,
                lg: 15,
            },
        },
        spacing: {
            xs: 5,
            sm: 10,
            md: 15,
            lg: 20,
            xl: 30,
        },
    };

    return {
        useTheme: () => theme,
        spacing: theme.spacing,
        layout: theme.layout
    };
});

// Mock navigation
jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        goBack: jest.fn(),
        navigate: jest.fn(),
    }),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
}));

// Mock Linking
jest.mock('react-native/Libraries/Linking/Linking', () => ({
    openSettings: jest.fn().mockResolvedValue(true),
}));

// Mock Auth context
jest.mock('../../context/AuthContext', () => ({
    useAuth: () => ({ user: { uid: 'test-user' } }),
}));

// Mock firestore utils
jest.mock('../../utils/firestore', () => ({
    updateUserProfile: jest.fn(),
}));

const renderWithProviders = (component) => {
    return render(component);
};

describe('NotificationSettingsScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        AsyncStorage.getItem.mockImplementation((key) => {
            if (key === 'localNotificationsEnabled') return Promise.resolve('false');
            return Promise.resolve(null);
        });
    });

    it('loads initial notification settings correctly', async () => {
        renderWithProviders(<NotificationSettingsScreen />);

        await waitFor(() => {
            expect(AsyncStorage.getItem).toHaveBeenCalledWith('localNotificationsEnabled');
        });
    });

    it('handles local notifications toggle correctly', async () => {
        const { getByRole } = renderWithProviders(<NotificationSettingsScreen />);
        const localToggle = getByRole('switch');

        fireEvent(localToggle, 'valueChange', true);

        await waitFor(() => {
            expect(AsyncStorage.setItem).toHaveBeenCalledWith('localNotificationsEnabled', 'true');
        });
    });

    it('opens system settings when button is pressed', async () => {
        const { getByText } = renderWithProviders(<NotificationSettingsScreen />);
        const settingsButton = getByText('Open System Settings');

        fireEvent.press(settingsButton);

        await waitFor(() => {
            expect(Linking.openSettings).toHaveBeenCalled();
        });
    });

    describe('Default Settings and Error Handling', () => {
        beforeEach(() => {
            jest.clearAllMocks();
            AsyncStorage.getItem.mockImplementation(() => Promise.resolve(null));
        });

        it('should default to enabled local notifications for new installations', async () => {
            const { getByRole } = renderWithProviders(<NotificationSettingsScreen />);

            await waitFor(() => {
                const localSwitch = getByRole('switch');
                expect(localSwitch.props.value).toBe(true);
            });

            expect(AsyncStorage.setItem).toHaveBeenCalledWith('localNotificationsEnabled', 'true');
        });

        it('should preserve existing local notification settings', async () => {
            AsyncStorage.getItem.mockImplementation((key) => {
                if (key === 'localNotificationsEnabled') return Promise.resolve('false');
                return Promise.resolve(null);
            });

            const { getByRole } = renderWithProviders(<NotificationSettingsScreen />);

            await waitFor(() => {
                const localSwitch = getByRole('switch');
                expect(localSwitch.props.value).toBe(false);
            });

            expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('localNotificationsEnabled', 'true');
        });

        it('should handle error cases gracefully', async () => {
            AsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

            const { getByRole } = renderWithProviders(<NotificationSettingsScreen />);

            await waitFor(() => {
                const localSwitch = getByRole('switch');
                expect(localSwitch.props.value).toBe(true);
            });
        });
    });
});
