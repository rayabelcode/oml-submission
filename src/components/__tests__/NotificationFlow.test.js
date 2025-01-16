// src/components/__tests__/NotificationFlow.test.js
import { DateTime } from 'luxon';
import { snoozeHandler } from '../../utils/snoozeHandler';

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
    addEventListener: jest.fn(),
    fetch: jest.fn().mockResolvedValue({
        isConnected: true,
        isInternetReachable: true
    })
}));

// Mock schedulingHistory with default export
jest.mock('../../utils/schedulingHistory', () => {
    const mockHistory = {
        initialize: jest.fn().mockResolvedValue(true),
        trackSnooze: jest.fn().mockResolvedValue(true),
        trackSkip: jest.fn().mockResolvedValue(true),
        storeReschedulingPattern: jest.fn().mockResolvedValue(true),
        analyzeContactPatterns: jest.fn().mockResolvedValue({
            successRates: {
                byHour: { '16': { successRate: 0.8 } }
            }
        })
    };
    return {
        __esModule: true,
        default: mockHistory,
        schedulingHistory: mockHistory
    };
});

// Mock Firebase
jest.mock('firebase/firestore', () => ({
    getFirestore: jest.fn(),
    doc: jest.fn(),
    getDoc: jest.fn(() => ({
        exists: () => true,
        data: () => ({
            scheduling: {},
            contact_history: []
        })
    })),
    updateDoc: jest.fn(),
    writeBatch: jest.fn(() => ({
        set: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(true)
    })),
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    getDocs: jest.fn(() => ({
        docs: []
    })),
    serverTimestamp: jest.fn(() => ({
        _seconds: Math.floor(Date.now() / 1000),
        _nanoseconds: 0
    })),
    initializeFirestore: jest.fn(() => ({})),
    persistentLocalCache: jest.fn(() => ({})),
    persistentMultipleTabManager: jest.fn(() => ({}))
}));

// Mock firebase config
jest.mock('../../config/firebase', () => ({
    db: {},
    auth: {
        currentUser: { uid: 'test-user' }
    },
    app: {}
}));

// Mock react-native
jest.mock('react-native', () => ({
    Platform: {
        OS: 'ios'
    },
    NativeModules: {
        RNCNetInfo: {
            getCurrentState: jest.fn(),
            getCurrentConnectivity: jest.fn(),
            isConnectionMetered: jest.fn(),
            addListener: jest.fn(),
            removeListeners: jest.fn(),
        }
    }
}));

describe('Notification Flow Integration', () => {
    const mockContactId = 'test-contact';
    const mockCurrentTime = DateTime.fromObject({ hour: 14 }); // 2 PM

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('handles complete snooze flow', async () => {
        await snoozeHandler.initialize();
        const snoozeResult = await snoozeHandler.handleSnooze(
            mockContactId,
            'later_today',
            mockCurrentTime
        );

        expect(snoozeResult).toBeTruthy();
    });

    it('handles skip flow', async () => {
        await snoozeHandler.initialize();
        const skipResult = await snoozeHandler.handleSnooze(
            mockContactId,
            'skip',
            mockCurrentTime
        );

        expect(skipResult).toBeTruthy();
    });

    it('respects scheduling patterns', async () => {
        const result = await snoozeHandler.handleSnooze(
            mockContactId,
            'later_today',
            mockCurrentTime
        );

        expect(result).toBeTruthy();
    });
	
});
