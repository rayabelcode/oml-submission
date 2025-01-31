import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SchedulingService } from '../src/utils/scheduler/scheduler.js';

const app = initializeApp();
const db = getFirestore();

export const testScheduler = onRequest(async (req, res) => {
    try {
        const results = {
            basicScheduling: {},
            edgeCases: {},
            timezones: {},
            errorHandling: {}
        };

        // Basic scheduling tests (keep existing)
        const scheduler = new SchedulingService(
            {
                scheduling_preferences: {
                    minimumGapMinutes: 20,
                    optimalGapMinutes: 1440
                }
            },
            [],
            'UTC',
            { isCloudFunction: true }
        );

        // 1. Basic Scheduling (keep existing tests)
        results.basicScheduling = testBasicScheduling(scheduler);

        // 2. Edge Cases
        results.edgeCases = testEdgeCases();

        // 3. Timezone Handling
        results.timezones = testTimezones();

        // 4. Error Handling
        results.errorHandling = testErrorHandling();

        res.json({
            success: true,
            results,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error in test function:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

function testBasicScheduling(scheduler) {
    const lastContactDate = new Date();
    return {
        daily: scheduler.calculatePreliminaryDate(lastContactDate, 'daily'),
        weekly: scheduler.calculatePreliminaryDate(lastContactDate, 'weekly'),
        biweekly: scheduler.calculatePreliminaryDate(lastContactDate, 'biweekly'),
        monthly: scheduler.calculatePreliminaryDate(lastContactDate, 'monthly')
    };
}

function testEdgeCases() {
    const results = {};
    
    // Test 1: Year boundary
    const yearEndDate = new Date('2024-12-31T12:00:00Z');
    const scheduler1 = new SchedulingService({}, [], 'UTC', { isCloudFunction: true });
    results.yearBoundary = {
        input: yearEndDate.toISOString(),
        weekly: scheduler1.calculatePreliminaryDate(yearEndDate, 'weekly'),
        monthly: scheduler1.calculatePreliminaryDate(yearEndDate, 'monthly')
    };

    // Test 2: DST transitions
    const dstDate = new Date('2024-03-10T01:00:00Z'); // US DST start
    const scheduler2 = new SchedulingService({}, [], 'America/New_York', { isCloudFunction: true });
    results.dstTransition = {
        input: dstDate.toISOString(),
        weekly: scheduler2.calculatePreliminaryDate(dstDate, 'weekly')
    };

    // Test 3: Leap year
    const leapYearDate = new Date('2024-02-28T12:00:00Z');
    results.leapYear = {
        input: leapYearDate.toISOString(),
        weekly: scheduler1.calculatePreliminaryDate(leapYearDate, 'weekly'),
        monthly: scheduler1.calculatePreliminaryDate(leapYearDate, 'monthly')
    };

    // Test 4: Month boundaries
    const monthEndDate = new Date('2024-01-31T12:00:00Z');
    results.monthBoundary = {
        input: monthEndDate.toISOString(),
        weekly: scheduler1.calculatePreliminaryDate(monthEndDate, 'weekly'),
        monthly: scheduler1.calculatePreliminaryDate(monthEndDate, 'monthly')
    };

    return results;
}

function testTimezones() {
    const results = {};
    const testDate = new Date('2024-01-15T12:00:00Z');
    const timezones = [
        'UTC',
        'America/New_York',
        'Asia/Tokyo',
        'Australia/Sydney',
        'Europe/London'
    ];

    timezones.forEach(tz => {
        const scheduler = new SchedulingService({}, [], tz, { isCloudFunction: true });
        results[tz] = {
            input: testDate.toISOString(),
            weekly: scheduler.calculatePreliminaryDate(testDate, 'weekly'),
            monthly: scheduler.calculatePreliminaryDate(testDate, 'monthly')
        };
    });

    return results;
}

function testErrorHandling() {
    const results = {};
    const scheduler = new SchedulingService({}, [], 'UTC', { isCloudFunction: true });

    // Test 1: Invalid frequency
    try {
        scheduler.calculatePreliminaryDate(new Date(), 'invalid_frequency');
        results.invalidFrequency = 'Failed: Should have thrown error';
    } catch (error) {
        results.invalidFrequency = 'Success: Error caught correctly';
    }

    // Test 2: Invalid date
    try {
        scheduler.calculatePreliminaryDate(new Date('invalid_date'), 'weekly');
        results.invalidDate = 'Failed: Should have thrown error';
    } catch (error) {
        results.invalidDate = 'Success: Error caught correctly';
    }

    // Test 3: Invalid timezone
    try {
        new SchedulingService({}, [], 'Invalid/Timezone', { isCloudFunction: true });
        results.invalidTimezone = 'Failed: Should have thrown error';
    } catch (error) {
        results.invalidTimezone = 'Success: Error caught correctly';
    }

    // Test 4: Missing required parameters
    try {
        scheduler.calculatePreliminaryDate(null, null);
        results.missingParams = 'Failed: Should have thrown error';
    } catch (error) {
        results.missingParams = 'Success: Error caught correctly';
    }

    return results;
}
