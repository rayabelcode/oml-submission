const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { Expo } = require("expo-server-sdk");

admin.initializeApp();
const expo = new Expo();

// Test Function: sends to Ray's device once per day at 10 AM
exports.testScheduledReminder = onSchedule("0 10 * * *", async (event) => {
  console.log("Running test notification function...");
  const TEST_USER_ID = "LTQ2OSK61lTjRdyqF9qXn94HW0t1"; // Ray's User ID

  try {
    const userDoc = await admin.firestore()
      .collection("users")
      .doc(TEST_USER_ID)
      .get();

    if (!userDoc.exists) {
      console.log("Test user not found");
      return null;
    }

    const userData = userDoc.data();
    console.log("Processing test notification for:", {
      username: userData.username,
      token: userData.expoPushToken,
    });

    if (!userData.expoPushToken || !Expo.isExpoPushToken(userData.expoPushToken)) {
      console.log("Invalid or missing Expo push token for test user");
      return null;
    }

    const messages = [{
      to: userData.expoPushToken,
      sound: "default",
      title: "Daily Test Notification",
      body: `Hello ${userData.first_name}! This is your daily test notification.`,
      data: {
        type: "TEST",
        timestamp: new Date().toISOString(),
      },
    }];

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        console.log("Test notification sent:", {
          username: userData.username,
          result: ticketChunk,
        });
      } catch (error) {
        console.error("Error sending test notification:", {
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
