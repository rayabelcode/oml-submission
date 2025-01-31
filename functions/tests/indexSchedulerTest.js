import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SchedulingService } from '../src/utils/scheduler/scheduler.js';

const app = initializeApp();
const db = getFirestore();
export const testScheduler = onRequest(async (req, res) => {
  try {
      const scheduler = new SchedulingService(
          {
              scheduling_preferences: {
                  minimumGapMinutes: 20,
                  optimalGapMinutes: 1440
              },
              relationship_types: {
                  friend: {
                      active_hours: { start: '09:00', end: '17:00' },
                      preferred_days: ['monday', 'wednesday', 'friday'],
                      excluded_times: []
                  }
              }
          },
          [], // empty reminders array
          'UTC',
          { isCloudFunction: true }
      );

      const testResults = {
          basicScheduling: {},
          preferredDays: {},
          timeBlocking: {},
          conflicts: {},
          priorityAdjustments: {},
          gapRequirements: {}
      };

      // 1. Test Basic Scheduling
      const frequencies = ['daily', 'weekly', 'biweekly', 'monthly'];
      const lastContactDate = new Date();
      testResults.basicScheduling = frequencies.map(freq => ({
          frequency: freq,
          result: scheduler.calculatePreliminaryDate(lastContactDate, freq)
      }));

      // 2. Test Preferred Days
      const contact = {
          id: 'test',
          user_id: 'test',
          scheduling: {
              relationship_type: 'friend',
              priority: 'normal'
          }
      };
      testResults.preferredDays = await scheduler.scheduleReminder(
          contact,
          lastContactDate,
          'weekly'
      );

      // 3. Test Time Blocking
      const blockedTime = new Date();
      blockedTime.setHours(12, 0, 0); // Noon
      testResults.timeBlocking = {
          isBlocked: scheduler.isTimeBlocked(blockedTime, contact),
          alternativeFound: scheduler.findAvailableTimeSlot(blockedTime, contact)
      };

      // 4. Test Conflict Resolution
      scheduler.reminders.push({
          scheduledTime: {
              toDate: () => new Date(Date.now() + 30 * 60000) // 30 minutes from now
          }
      });
      const conflictTime = new Date(Date.now() + 25 * 60000); // 25 minutes from now
      testResults.conflicts = {
          hasConflict: scheduler.hasTimeConflict(conflictTime),
          resolvedTime: await scheduler.resolveConflict(conflictTime, contact)
      };

      // 5. Test Priority Adjustments
      const highPriorityContact = {
          ...contact,
          scheduling: { ...contact.scheduling, priority: 'high' }
      };
      testResults.priorityAdjustments = {
          normal: scheduler.calculatePriorityScore(contact),
          high: scheduler.calculatePriorityScore(highPriorityContact)
      };

      // 6. Test Gap Requirements
      testResults.gapRequirements = scheduler.validateGapRequirements(
          new Date(Date.now() + 120 * 60000), // 2 hours from now
          {
              scheduling_preferences: {
                  minimumGapMinutes: 20,
                  optimalGapMinutes: 1440
              }
          }
      );

      res.json({
          success: true,
          results: testResults,
          summary: {
              totalTests: Object.keys(testResults).length,
              timestamp: new Date().toISOString()
          }
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
