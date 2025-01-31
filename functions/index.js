import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { DateTime } from "luxon";
import { Expo } from "expo-server-sdk";
import { SchedulingService } from "./src/utils/scheduler.js";

// Initialize Firebase admin and services
/* eslint-disable-next-line no-unused-vars */
const app = initializeApp();
const db = getFirestore();
/* eslint-disable-next-line no-unused-vars */
const messaging = getMessaging();
const expo = new Expo();

export const healthCheck = onRequest({
  timeoutSeconds: 30,
  memory: "256MiB",
}, (req, res) => {
  res.status(200).send("OK");
});

// Function 1: Test that sends a notification to my devices once per day at 10:20 AM Eastern Time
export const scheduledNotification = onSchedule({
  schedule: "20 10 * * *",
  timeZone: "America/New_York",
  timeoutSeconds: 120,
  memory: "256MiB",
  retryCount: 3,
}, async (event) => {
  console.log("Running test notification function...");
  const TEST_USER_ID = "LTQ2OSK61lTjRdyqF9qXn94HW0t1"; // Ray's User ID

  try {
    const userDoc = await db.collection("users").doc(TEST_USER_ID).get();

    if (!userDoc.exists) {
      console.log("Test user not found");
      return null;
    }

    const userData = userDoc.data();
    console.log("Processing test notification for:", {
      username: userData.username,
      tokens: userData.expoPushTokens,
    });

    if (!userData.expoPushTokens || !userData.expoPushTokens.length) {
      console.log("No valid Expo push tokens found for test user");
      return null;
    }

    // Map tokens to messages for batch sending
    const messages = userData.expoPushTokens.map((token) => ({
      to: token,
      sound: "default",
      title: "Daily Test Notification",
      body: `Hello ${userData.first_name}! This is your daily test notification.`,
      data: {
        type: "TEST",
        timestamp: new Date().toISOString(),
      },
    }));

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        console.log("Test notifications sent:", {
          username: userData.username,
          result: ticketChunk,
        });

        // Clean up invalid tokens
        ticketChunk.forEach(async (ticket, index) => {
          if (
            ticket.status === "error" &&
              ticket.details &&
              ticket.details.error === "DeviceNotRegistered"
          ) {
            const invalidToken = userData.expoPushTokens[index];
            console.log("Removing invalid token:", invalidToken);
            await db
              .collection("users")
              .doc(TEST_USER_ID)
              .update({
                expoPushTokens: FieldValue.arrayRemove(invalidToken),
              });
          }
        });
      } catch (error) {
        console.error("Error sending test notifications:", {
          username: userData.username,
          error: error.message,
        });
      }
    }

    return null;
  } catch (error) {
    console.error("Error in test function:", error);
    return null;
  }
},
);

// Function 2: Process reminders and send notifications
export const processReminders = onSchedule({
  schedule: "* * * * *",
  timeZone: "America/New_York",
  timeoutSeconds: 120,
  memory: "256MiB",
  retryCount: 3,
}, async (event) => {
  console.log("Checking for due reminders...");

  try {
    // Check 5-minute window for due reminders
    const now = Timestamp.now();
    const endTime = Timestamp.fromMillis(now.toMillis() + 5 * 60 * 1000);

    // Get all due, unnotified reminders
    const remindersSnapshot = await db
      .collection("reminders")
      .where("scheduledTime", "<=", endTime)
      .where("notified", "==", false)
      .where("type", "==", "SCHEDULED")
      .where("status", "==", "pending")
      .where("snoozed", "==", false)
      .get();

    console.log(`Found ${remindersSnapshot.size} reminders to process`);

    for (const reminderDoc of remindersSnapshot.docs) {
      const reminder = reminderDoc.data();
      const userDoc = await db.collection("users").doc(reminder.user_id).get();

      if (!userDoc.exists || !userDoc.data().expoPushTokens || !userDoc.data().expoPushTokens.length) {
        console.log(`No valid tokens for user ${reminder.user_id}`);
        continue;
      }

      // Prep notification messages for each user device
      const userData = userDoc.data();
      const messages = userData.expoPushTokens.map((token) => ({
        to: token,
        sound: "default",
        title: "Scheduled Call",
        body: `Time to call ${reminder.contactName}`,
        data: {
          type: "SCHEDULED",
          reminderId: reminderDoc.id,
          contactId: reminder.contact_id,
          userId: reminder.user_id,
        },
      }));

      const chunks = expo.chunkPushNotifications(messages);
      let notificationSent = false;

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          console.log("Notifications sent:", {
            userId: reminder.user_id,
            reminderId: reminderDoc.id,
            result: ticketChunk,
          });

          notificationSent = ticketChunk.some((ticket) => ticket.status === "ok");

          // Clean up invalid tokens
          ticketChunk.forEach(async (ticket, index) => {
            if (
              ticket.status === "error" &&
								ticket.details &&
								ticket.details.error === "DeviceNotRegistered"
            ) {
              const invalidToken = userData.expoPushTokens[index];
              console.log("Removing invalid token:", invalidToken);
              await db
                .collection("users")
                .doc(reminder.user_id)
                .update({
                  expoPushTokens: FieldValue.arrayRemove(invalidToken),
                });
            }
          });
        } catch (error) {
          console.error("Error sending notifications:", error);
        }
      }

      // Only update DB if notification was sent successfully
      if (notificationSent) {
        const batch = db.batch();

        // Mark reminder as completed
        batch.update(reminderDoc.ref, {
          notified: true,
          status: "completed",
          completion_time: FieldValue.serverTimestamp(),
          notifiedAt: FieldValue.serverTimestamp(),
        });

        // Update contact's schedule if needed
        const contactRef = db.collection("contacts").doc(reminder.contact_id);
        const contactDoc = await contactRef.get();
        if (contactDoc.exists) {
          const contactData = contactDoc.data();
          const reminderTime = reminder.scheduledTime.toDate().getTime();
          const nextContactTime = contactData.next_contact ?
            new Date(contactData.next_contact).getTime() :
            null;

          // Only update if this reminder matches the next contact time
          if (nextContactTime === reminderTime) {
            // Get scheduling preferences
            const userPrefsDoc = await db.collection("user_preferences").doc(reminder.user_id).get();
            const userPreferences = userPrefsDoc.exists ? userPrefsDoc.data() : {};

            // Calculate next contact date using scheduler
            const scheduler = new SchedulingService(
              userPreferences,
              [], // Empty array since we're just calculating next date
              "UTC", // Use UTC for cloud functions
              { isCloudFunction: true },
            );

            const updates = {
              last_contacted: FieldValue.serverTimestamp(),
              last_updated: FieldValue.serverTimestamp(),
            };

            // Handle recurring schedule updates
            if (contactData.scheduling?.frequency) {
              try {
                const nextRecurring = await scheduler.scheduleRecurringReminder(
                  contactData,
                  new Date(),
                  contactData.scheduling.frequency,
                );

                if (nextRecurring.scheduledTime) {
                  updates["scheduling.recurring_next_date"] = nextRecurring.scheduledTime.toDate();
                }
              } catch (error) {
                console.error("Error calculating next recurring date:", error);
                updates["scheduling.recurring_next_date"] = null;
              }
            }

            // Clear custom date if it was used
            if (contactData.scheduling?.custom_next_date) {
              const customTime = new Date(contactData.scheduling.custom_next_date).getTime();
              if (customTime === reminderTime) {
                updates["scheduling.custom_next_date"] = null;
              }
            }

            // Set next contact to earliest available date
            const possibleDates = [
              updates["scheduling.recurring_next_date"],
              contactData.scheduling?.custom_next_date,
            ]
              .filter(Boolean)
              .map((date) => (date instanceof Date ? date : new Date(date)));

            updates.next_contact =
                possibleDates.length > 0 ?
                  new Date(Math.min(...possibleDates.map((d) => d.getTime()))) :
                  null;

            batch.update(contactRef, updates);
          }
        }

        // Commit all updates atomically
        await batch.commit();

        console.log("Updated reminder and contact:", {
          reminderId: reminderDoc.id,
          contactId: reminder.contact_id,
          status: "completed",
        });
      }
    }

    return null;
  } catch (error) {
    console.error("Error processing reminders:", error);
    return null;
  }
},
);

// Function 3: Test endpoint for verification 'firebase emulators:start --only functions'
export const testScheduler = onRequest({
  timeoutSeconds: 60,
  memory: "256MiB",
}, async (req, res) => {
  try {
    // Test categories setup
    const results = {
      basicScheduling: {},
      edgeCases: {},
      timezones: {},
      errorHandling: {},
    };

    // Init scheduler with basic config
    const scheduler = new SchedulingService(
      {
        scheduling_preferences: {
          minimumGapMinutes: 20,
          optimalGapMinutes: 1440,
        },
      },
      [],
      "UTC",
      { isCloudFunction: true },
    );

    // Run all test suites
    results.basicScheduling = testBasicScheduling(scheduler);
    results.edgeCases = testEdgeCases();
    results.timezones = testTimezones();
    results.errorHandling = testErrorHandling();

    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in test function:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Test basic scheduling functionality
function testBasicScheduling(scheduler) {
  const lastContactDate = new Date();
  return {
    daily: scheduler.calculatePreliminaryDate(lastContactDate, "daily"),
    weekly: scheduler.calculatePreliminaryDate(lastContactDate, "weekly"),
    biweekly: scheduler.calculatePreliminaryDate(lastContactDate, "biweekly"),
    monthly: scheduler.calculatePreliminaryDate(lastContactDate, "monthly"),
  };
}

// Test calendar edge cases
function testEdgeCases() {
  const results = {};

  // Test 1: Year boundary
  const yearEndDate = new Date("2024-12-31T12:00:00Z");
  const scheduler1 = new SchedulingService({}, [], "UTC", { isCloudFunction: true });
  results.yearBoundary = {
    input: yearEndDate.toISOString(),
    weekly: scheduler1.calculatePreliminaryDate(yearEndDate, "weekly"),
    monthly: scheduler1.calculatePreliminaryDate(yearEndDate, "monthly"),
  };

  // Test 2: DST transitions
  const dstDate = new Date("2024-03-10T01:00:00Z"); // US DST start
  const scheduler2 = new SchedulingService({}, [], "America/New_York", { isCloudFunction: true });
  results.dstTransition = {
    input: dstDate.toISOString(),
    weekly: scheduler2.calculatePreliminaryDate(dstDate, "weekly"),
  };

  // Test 3: Leap year
  const leapYearDate = new Date("2024-02-28T12:00:00Z");
  results.leapYear = {
    input: leapYearDate.toISOString(),
    weekly: scheduler1.calculatePreliminaryDate(leapYearDate, "weekly"),
    monthly: scheduler1.calculatePreliminaryDate(leapYearDate, "monthly"),
  };

  // Test 4: Month boundaries
  const monthEndDate = new Date("2024-01-31T12:00:00Z");
  results.monthBoundary = {
    input: monthEndDate.toISOString(),
    weekly: scheduler1.calculatePreliminaryDate(monthEndDate, "weekly"),
    monthly: scheduler1.calculatePreliminaryDate(monthEndDate, "monthly"),
  };

  return results;
}

// Test timezone handling across regions
function testTimezones() {
  const results = {};
  const testDate = new Date("2024-01-15T12:00:00Z");
  const timezones = ["UTC", "America/New_York", "Asia/Tokyo", "Australia/Sydney", "Europe/London"];

  timezones.forEach((tz) => {
    const scheduler = new SchedulingService({}, [], tz, { isCloudFunction: true });
    const localDateTime = DateTime.fromJSDate(testDate).setZone(tz);
    results[tz] = {
      input: testDate.toISOString(),
      localTime: localDateTime.toFormat("yyyy-MM-dd HH:mm:ss Z"),
      weekly: scheduler.calculatePreliminaryDate(testDate, "weekly"),
      monthly: scheduler.calculatePreliminaryDate(testDate, "monthly"),
      offset: localDateTime.offset / 60, // offset in hours
    };
  });

  return results;
}

// Test error handling and edge cases
function testErrorHandling() {
  const results = {};
  const scheduler = new SchedulingService({}, [], "UTC", { isCloudFunction: true });

  // Test 1: Invalid frequency
  try {
    scheduler.calculatePreliminaryDate(new Date(), "invalid_frequency");
    results.invalidFrequency = "Failed: Should have thrown error";
  } catch (error) {
    results.invalidFrequency = "Success: Error caught correctly";
  }

  // Test 2: Invalid date
  try {
    scheduler.calculatePreliminaryDate(new Date("invalid_date"), "weekly");
    results.invalidDate = "Failed: Should have thrown error";
  } catch (error) {
    results.invalidDate = "Success: Error caught correctly";
  }

  // Test 3: Invalid timezone (updated to test fallback behavior)
  try {
    const invalidTzService = new SchedulingService({}, [], "Invalid/Timezone", { isCloudFunction: true });
    results.invalidTimezone =
    invalidTzService.timeZone === "UTC" ?
      "Success: Fallback to UTC correctly" :
      "Failed: Did not fallback to UTC";
  } catch (error) {
    results.invalidTimezone = "Failed: Should not throw error";
  }

  // Test 4: Missing parameters
  try {
    scheduler.calculatePreliminaryDate(null, null);
    results.missingParams = "Failed: Should have thrown error";
  } catch (error) {
    results.missingParams = "Success: Error caught correctly";
  }

  return results;
}
