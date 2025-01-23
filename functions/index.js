const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { Expo } = require("expo-server-sdk");

admin.initializeApp();
const expo = new Expo();

// Test function that sends to my device once per day at 10:20 AM Eastern Time
exports.scheduledNotification = onSchedule({
  schedule: "20 10 * * *",
  timeZone: "America/New_York", // Local time zone
}, async (event) => {
  console.log("Running test notification function...");
  const TEST_USER_ID = "LTQ2OSK61lTjRdyqF9qXn94HW0t1"; // Ray's User ID

  try {
    const userDoc = await admin.firestore().collection("users").doc(TEST_USER_ID).get();

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

        ticketChunk.forEach(async (ticket, index) => {
          if (ticket.status === "error" && ticket.details && ticket.details.error === "DeviceNotRegistered") {
            const invalidToken = userData.expoPushTokens[index];
            console.log("Removing invalid token:", invalidToken);
            await admin.firestore().collection("users").doc(TEST_USER_ID).update({
              expoPushTokens: admin.firestore.FieldValue.arrayRemove(invalidToken),
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
});
