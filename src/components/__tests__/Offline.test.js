import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { View, Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { notificationCoordinator } from '../../utils/notificationCoordinator';
import { cacheManager } from '../../utils/cache';

// Simple offline component to test
function OfflineIndicator({ isOffline }) {
  return isOffline ? (
    <View testID="offline-indicator">
      <Text>Offline Mode</Text>
    </View>
  ) : null;
}

// Mock NetInfo outside of the test
let mockIsConnected = true;
let mockNetInfoCallback = null;

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn((callback) => {
    mockNetInfoCallback = callback;
    return jest.fn();
  }),
  fetch: jest.fn(() => Promise.resolve({ isConnected: mockIsConnected })),
}));

// Mock notification coordinator
jest.mock('../../utils/notificationCoordinator', () => ({
  notificationCoordinator: {
    storePendingOperation: jest.fn(() => Promise.resolve()),
    processPendingOperations: jest.fn(() => Promise.resolve()),
    hasPendingOperations: jest.fn(() => Promise.resolve(false)),
  }
}));

// Mock cache manager
jest.mock('../../utils/cache', () => ({
  cacheManager: {
    getCachedUpcomingContacts: jest.fn(() => Promise.resolve([
      { id: 'cached-1', first_name: 'Cached', last_name: 'Contact' }
    ])),
    saveUpcomingContacts: jest.fn(() => Promise.resolve()),
    getCachedStats: jest.fn(() => Promise.resolve({ 
      detailed: { needsAttention: [] } 
    })),
    saveStats: jest.fn(() => Promise.resolve()),
  }
}));

// Simple component that uses NetInfo
function OfflineAwareComponent() {
  const [isOffline, setIsOffline] = React.useState(false);
  const [wasOffline, setWasOffline] = React.useState(false); // Track previous offline state
  const [usedCache, setUsedCache] = React.useState(false);
  const NetInfo = require('@react-native-community/netinfo');
  
  React.useEffect(() => {
    const checkConnection = async () => {
      const state = await NetInfo.fetch();
      setIsOffline(!state.isConnected);
      setWasOffline(!state.isConnected);

      // Try to load cached data when offline
      if (!state.isConnected) {
        const cachedContacts = await cacheManager.getCachedUpcomingContacts('test-user');
        if (cachedContacts && cachedContacts.length > 0) {
          setUsedCache(true);
        }
      }
    };
    
    checkConnection();
    
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });
    
    return () => unsubscribe();
  }, []);

  // Effect to detect changes from offline to online
  React.useEffect(() => {
    const syncWhenBackOnline = async () => {
      // If we were offline and now we're online
      if (wasOffline && !isOffline) {
        const hasPending = await notificationCoordinator.hasPendingOperations();
        if (hasPending) {
          await notificationCoordinator.processPendingOperations();
        }
      }
      setWasOffline(isOffline);
    };

    syncWhenBackOnline();
  }, [isOffline, wasOffline]);

  // Simulate a snooze operation  
  const handleSnooze = async () => {
    if (isOffline) {
      await notificationCoordinator.storePendingOperation({
        type: 'snooze',
        data: {
          contactId: 'test-contact',
          optionId: 'later_today',
          reminderType: 'SCHEDULED',
          reminderId: 'test-reminder',
        },
      });
      return true;
    }
    return false;
  };
  
  return (
    <View>
      <OfflineIndicator isOffline={isOffline} />
      {usedCache && <View testID="used-cache" />}
      <View testID="snooze-button" onClick={handleSnooze} />
    </View>
  );
}

describe('Offline Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsConnected = true; // Reset to online by default
  });


  test('should show when device is offline', async () => {
    mockIsConnected = false;
    
    let { queryByTestId } = render(<OfflineAwareComponent />);
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    expect(queryByTestId('offline-indicator')).toBeTruthy();
  });
  
  test('should not show when device is online', async () => {
    mockIsConnected = true;
    
    let { queryByTestId } = render(<OfflineAwareComponent />);
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    expect(queryByTestId('offline-indicator')).toBeNull();
  });
  
  test('should respond to network changes', async () => {
    mockIsConnected = true;
    
    let { queryByTestId } = render(<OfflineAwareComponent />);
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    expect(queryByTestId('offline-indicator')).toBeNull();
    
    await act(async () => {
      mockNetInfoCallback({ isConnected: false });
    });
    
    expect(queryByTestId('offline-indicator')).toBeTruthy();
    
    await act(async () => {
      mockNetInfoCallback({ isConnected: true });
    });
    
    expect(queryByTestId('offline-indicator')).toBeNull();
  });


  
  test('should use cached data when offline', async () => {
    mockIsConnected = false;
    
    let { findByTestId } = render(<OfflineAwareComponent />);
    
    // Wait for async operations to complete
    await waitFor(() => {
      expect(cacheManager.getCachedUpcomingContacts).toHaveBeenCalledWith('test-user');
    });
    
    // Check that our component indicates it used the cache
    const cacheIndicator = await findByTestId('used-cache');
    expect(cacheIndicator).toBeTruthy();
  });
  
  test('should queue operations when offline', async () => {
    mockIsConnected = false;
    
    let { getByTestId } = render(<OfflineAwareComponent />);
    
    // Wait for component to detect offline state
    await waitFor(() => {
      expect(getByTestId('offline-indicator')).toBeTruthy();
    });
    
    // Trigger the snooze operation
    await act(async () => {
      getByTestId('snooze-button').props.onClick();
    });
    
    // Verify the operation was queued
    expect(notificationCoordinator.storePendingOperation).toHaveBeenCalledWith({
      type: 'snooze',
      data: {
        contactId: 'test-contact',
        optionId: 'later_today',
        reminderType: 'SCHEDULED',
        reminderId: 'test-reminder',
      },
    });
  });
  
  test('should process pending operations when back online', async () => {
		// Start offline with pending operations
		mockIsConnected = false;
		notificationCoordinator.hasPendingOperations.mockResolvedValue(true);

		let { queryByTestId } = render(<OfflineAwareComponent />);

		// Wait for component to initialize
		await waitFor(() => {
			expect(queryByTestId('offline-indicator')).toBeTruthy();
		});

		// Go back online
		await act(async () => {
			mockIsConnected = true;
			mockNetInfoCallback({ isConnected: true });
			// Wait for React to process the state change
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		// Confirm the component is now online
		expect(queryByTestId('offline-indicator')).toBeNull();

		// Check if processPendingOperations was called
		await waitFor(() => {
			expect(notificationCoordinator.processPendingOperations).toHaveBeenCalled();
		});
	});
});
