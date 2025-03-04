import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { Expo } from "expo-server-sdk";
import { SchedulingService } from "./src/schedulerCloud.js";

// Initialize Firebase admin and services
/* eslint-disable-next-line no-unused-vars */
const app = initializeApp();
const db = getFirestore();
/* eslint-disable-next-line no-unused-vars */
const messaging = getMessaging();
const expo = new Expo();

export const healthCheck = onRequest(
  {
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  (req, res) => {
    res.status(200).send("OK");
  },
);

// Function 1: Daily test notification sent at 10:20 AM ET
export const scheduledNotification = onSchedule(
  {
    schedule: "20 10 * * *", // Every day at 10:20 AM
    timeZone: "America/New_York",
    timeoutSeconds: 120,
    memory: "256MiB",
    retryCount: 3,
  },
  async (event) => {
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

// Function 2: Process SCHEDULED reminders
export const processReminders = onSchedule(
  {
    schedule: "* * * * *", // Every minute
    timeZone: "America/New_York",
    timeoutSeconds: 120,
    memory: "256MiB",
    retryCount: 3,
  },
  async (event) => {
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
          categoryId: "SCHEDULED",
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
            status: "sent",
            completion_time: FieldValue.serverTimestamp(),
            notifiedAt: FieldValue.serverTimestamp(),
          });

          // Update contact's schedule if needed
          const contactRef = db.collection("contacts").doc(reminder.contact_id);
          const contactDoc = await contactRef.get();
          if (contactDoc.exists) {
            const contactData = contactDoc.data();
            const reminderTime = reminder.scheduledTime.toDate().getTime();

            // Simplified condition: process if contact has frequency
            if (contactData.scheduling?.frequency) {
              // Get scheduling preferences
              const userPrefsDoc = await db.collection("user_preferences").doc(reminder.user_id).get();
              const userPreferences = userPrefsDoc.exists ? userPrefsDoc.data() : {};

              // Calculate next contact date using scheduler
              const scheduler = new SchedulingService(
                userPreferences,
                [], // Empty array since we're calculating next date
                "America/New_York", // Use user's timezone
                {
                  isCloudFunction: true,
                  enforceActiveHours: true,
                },
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

                  console.log("Next recurring calculation result:", {
                    contactId: reminder.contact_id,
                    result: nextRecurring,
                    scheduledTime: nextRecurring.scheduledTime ? nextRecurring.scheduledTime.toDate() : null,
                  });

                  if (nextRecurring.scheduledTime) {
                    // Update contact's scheduling info
                    updates["scheduling.recurring_next_date"] = nextRecurring.scheduledTime
                      .toDate()
                      .toISOString();
                    updates["next_contact"] = nextRecurring.scheduledTime.toDate();

                    // Create new reminder document reference
                    const newReminderRef = db.collection("reminders").doc();

                    const newReminderData = {
                      created_at: FieldValue.serverTimestamp(),
                      updated_at: FieldValue.serverTimestamp(),
                      contact_id: reminder.contact_id,
                      user_id: reminder.user_id,
                      status: "pending",
                      type: "SCHEDULED",
                      frequency: contactData.scheduling.frequency,
                      snoozed: false,
                      needs_attention: false,
                      completed: false,
                      completion_time: null,
                      notes_added: false,
                      contactName: reminder.contactName,
                      notified: false,
                      scheduledTime: nextRecurring.scheduledTime,
                    };

                    batch.set(newReminderRef, newReminderData);
                  } else {
                    console.error("No valid next time found:", {
                      contactId: reminder.contact_id,
                      nextRecurring,
                    });
                  }
                } catch (error) {
                  console.error("Error in recurring schedule update:", {
                    contactId: reminder.contact_id,
                    error: error.message,
                    stack: error.stack,
                  });
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

              updates.next_contact = possibleDates.length > 0 ?
                new Date(Math.min(...possibleDates.map((d) => d.getTime()))) :
                null;

              batch.update(contactRef, updates);
            }
          }

          // Commit all updates atomically
          await batch.commit();

          // Log success after commit
          console.log("Batch commit successful:", {
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

// Function 3: Process CUSTOM_DATE reminders
export const processCustomReminders = onSchedule(
  {
    schedule: "* * * * *", // Every minute
    timeZone: "America/New_York",
    timeoutSeconds: 120,
    memory: "256MiB",
    retryCount: 3,
  },
  async (event) => {
    console.log("Checking for CUSTOM_DATE reminders...");

    try {
      const now = Timestamp.now();
      const endTime = Timestamp.fromMillis(now.toMillis() + 5 * 60 * 1000);

      const remindersSnapshot = await db
        .collection("reminders")
        .where("scheduledTime", "<=", endTime)
        .where("type", "==", "CUSTOM_DATE")
        .where("status", "==", "pending")
        .where("notified", "==", false)
        .where("snoozed", "==", false)
        .get();

      console.log(`Found ${remindersSnapshot.size} custom date reminders to process`);

      for (const reminderDoc of remindersSnapshot.docs) {
        const reminder = reminderDoc.data();
        const userDoc = await db.collection("users").doc(reminder.user_id).get();

        if (!userDoc.exists || !userDoc.data().expoPushTokens || !userDoc.data().expoPushTokens.length) {
          console.log(`No valid tokens for user ${reminder.user_id}`);
          continue;
        }

        const userData = userDoc.data();
        const messages = userData.expoPushTokens.map((token) => ({
          to: token,
          sound: "default",
          title: "Custom Call Reminder",
          body: `Time to call ${reminder.contactName}`,
          categoryId: "CUSTOM_DATE",
          data: {
            type: "CUSTOM_DATE",
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
            console.log("Custom reminder notification sent:", {
              userId: reminder.user_id,
              reminderId: reminderDoc.id,
              result: ticketChunk,
            });

            notificationSent = ticketChunk.some((ticket) => ticket.status === "ok");

            // Clean up invalid tokens
            ticketChunk.forEach(async (ticket, index) => {
              if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
                const invalidToken = userData.expoPushTokens[index];
                await db
                  .collection("users")
                  .doc(reminder.user_id)
                  .update({
                    expoPushTokens: FieldValue.arrayRemove(invalidToken),
                  });
              }
            });
          } catch (error) {
            console.error("Error sending custom reminder notification:", error);
          }
        }

        if (notificationSent) {
          const batch = db.batch();

          // Update reminder
          batch.update(reminderDoc.ref, {
            notified: true,
            status: "sent",
            completion_time: FieldValue.serverTimestamp(),
            notifiedAt: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp(),
          });

          // Update contact's schedule
          const contactRef = db.collection("contacts").doc(reminder.contact_id);
          const contactDoc = await contactRef.get();

          if (contactDoc.exists) {
            batch.update(contactRef, {
              "last_contacted": FieldValue.serverTimestamp(),
              "last_updated": FieldValue.serverTimestamp(),
              "scheduling.custom_next_date": null,
            });
          }

          await batch.commit();

          console.log("Custom reminder processed:", {
            reminderId: reminderDoc.id,
            contactId: reminder.contact_id,
            status: "sent",
          });
        }
      }

      return null;
    } catch (error) {
      console.error("Error processing custom reminders:", error);
      return null;
    }
  },
);

// Function 4: Process 'snoozed' SCHEDULED reminders
export const processSnoozedScheduledReminders = onSchedule(
  {
    schedule: "* * * * *",
    timeZone: "America/New_York",
    timeoutSeconds: 120,
    memory: "256MiB",
    retryCount: 3,
  },
  async (event) => {
    console.log("Checking for snoozed SCHEDULED reminders...");

    try {
      const now = Timestamp.now();
      const endTime = Timestamp.fromMillis(now.toMillis() + 5 * 60 * 1000);

      const snoozedSnapshot = await db
        .collection("reminders")
        .where("scheduledTime", "<=", endTime)
        .where("status", "==", "snoozed")
        .where("snoozed", "==", true)
        .where("type", "==", "SCHEDULED")
        .get();

      console.log(`Found ${snoozedSnapshot.size} snoozed SCHEDULED reminders to process`);

      for (const reminderDoc of snoozedSnapshot.docs) {
        const reminder = reminderDoc.data();
        const userDoc = await db.collection("users").doc(reminder.user_id).get();

        if (!userDoc.exists || !userDoc.data().expoPushTokens || !userDoc.data().expoPushTokens.length) {
          console.log(`No valid tokens for user ${reminder.user_id}`);
          continue;
        }

        const userData = userDoc.data();
        const messages = userData.expoPushTokens.map((token) => ({
          to: token,
          sound: "default",
          title: "Snoozed Call Reminder",
          body: `Time to call ${reminder.contactName}`,
          categoryId: "SCHEDULED",
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
            console.log("Snoozed SCHEDULED reminder notification sent:", {
              userId: reminder.user_id,
              reminderId: reminderDoc.id,
              result: ticketChunk,
            });

            notificationSent = ticketChunk.some((ticket) => ticket.status === "ok");

            ticketChunk.forEach(async (ticket, index) => {
              if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
                const invalidToken = userData.expoPushTokens[index];
                await db
                  .collection("users")
                  .doc(reminder.user_id)
                  .update({
                    expoPushTokens: FieldValue.arrayRemove(invalidToken),
                  });
              }
            });
          } catch (error) {
            console.error("Error sending snoozed SCHEDULED reminder notification:", error);
          }
        }

        if (notificationSent) {
          const batch = db.batch();

          // Mark the snoozed reminder as sent
          batch.update(reminderDoc.ref, {
            status: "sent",
            snoozed: false,
            completion_time: FieldValue.serverTimestamp(),
            notifiedAt: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp(),
          });

          // Update contact's last_contacted timestamp
          const contactRef = db.collection("contacts").doc(reminder.contact_id);
          const contactDoc = await contactRef.get();

          if (contactDoc.exists) {
            const updates = {
              last_contacted: FieldValue.serverTimestamp(),
              last_updated: FieldValue.serverTimestamp(),
            };

            batch.update(contactRef, updates);
          }

          await batch.commit();

          console.log("Snoozed SCHEDULED reminder processed:", {
            reminderId: reminderDoc.id,
            contactId: reminder.contact_id,
            status: "sent",
          });
        }
      }

      return null;
    } catch (error) {
      console.error("Error processing snoozed SCHEDULED reminders:", error);
      return null;
    }
  },
);


// Function 5: Process 'snoozed' CUSTOM_DATE reminders
export const processSnoozedCustomReminders = onSchedule(
  {
    schedule: "* * * * *",
    timeZone: "America/New_York",
    timeoutSeconds: 120,
    memory: "256MiB",
    retryCount: 3,
  },
  async (event) => {
    console.log("Checking for snoozed CUSTOM_DATE reminders...");

    try {
      const now = Timestamp.now();
      const endTime = Timestamp.fromMillis(now.toMillis() + 5 * 60 * 1000);

      const snoozedSnapshot = await db
        .collection("reminders")
        .where("scheduledTime", "<=", endTime)
        .where("status", "==", "snoozed")
        .where("snoozed", "==", true)
        .where("type", "==", "CUSTOM_DATE")
        .get();

      console.log(`Found ${snoozedSnapshot.size} snoozed CUSTOM_DATE reminders to process`);

      for (const reminderDoc of snoozedSnapshot.docs) {
        const reminder = reminderDoc.data();
        const userDoc = await db.collection("users").doc(reminder.user_id).get();

        if (!userDoc.exists || !userDoc.data().expoPushTokens || !userDoc.data().expoPushTokens.length) {
          console.log(`No valid tokens for user ${reminder.user_id}`);
          continue;
        }

        const userData = userDoc.data();
        const messages = userData.expoPushTokens.map((token) => ({
          to: token,
          sound: "default",
          title: "Snoozed Custom Call Reminder",
          body: `Time to call ${reminder.contactName}`,
          categoryId: "CUSTOM_DATE",
          data: {
            type: "CUSTOM_DATE",
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
            console.log("Snoozed CUSTOM_DATE reminder notification sent:", {
              userId: reminder.user_id,
              reminderId: reminderDoc.id,
              result: ticketChunk,
            });

            notificationSent = ticketChunk.some((ticket) => ticket.status === "ok");

            ticketChunk.forEach(async (ticket, index) => {
              if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
                const invalidToken = userData.expoPushTokens[index];
                await db
                  .collection("users")
                  .doc(reminder.user_id)
                  .update({
                    expoPushTokens: FieldValue.arrayRemove(invalidToken),
                  });
              }
            });
          } catch (error) {
            console.error("Error sending snoozed CUSTOM_DATE reminder notification:", error);
          }
        }

        if (notificationSent) {
          const batch = db.batch();

          batch.update(reminderDoc.ref, {
            status: "sent",
            snoozed: false,
            completion_time: FieldValue.serverTimestamp(),
            notifiedAt: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp(),
          });

          const contactRef = db.collection("contacts").doc(reminder.contact_id);
          const contactDoc = await contactRef.get();

          if (contactDoc.exists) {
            batch.update(contactRef, {
              "last_contacted": FieldValue.serverTimestamp(),
              "last_updated": FieldValue.serverTimestamp(),
              "scheduling.custom_next_date": null,
            });
          }

          await batch.commit();

          console.log("Snoozed CUSTOM_DATE reminder processed:", {
            reminderId: reminderDoc.id,
            contactId: reminder.contact_id,
            status: "sent",
          });
        }
      }

      return null;
    } catch (error) {
      console.error("Error processing snoozed CUSTOM_DATE reminders:", error);
      return null;
    }
  },
);
