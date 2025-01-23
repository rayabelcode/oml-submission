const { Expo } = require("expo-server-sdk");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// New Expo SDK client
const expo = new Expo();

// Delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sendNotification = async () => {
  const TEST_USER_ID = "LTQ2OSK61lTjRdyqF9qXn94HW0t1";

  try {
    // Get user document from Firestore
    const userDoc = await admin.firestore().collection("users").doc(TEST_USER_ID).get();
    
    if (!userDoc.exists) {
      console.log("User not found");
      return;
    }

    const userData = userDoc.data();
    const pushTokens = userData.expoPushTokens;

    console.log(`Found ${pushTokens.length} tokens for user ${userData.username}:`, pushTokens);

    // Create messages for all tokens
    const messages = pushTokens.map(token => ({
      to: token,
      sound: "default",
      title: "Hello, Ray!",
      body: "Your notification has been delivered successfully!",
      data: { extraData: "testValue" },
    }));

    console.log(`\nPreparing to send notifications to ${messages.length} devices...`);

    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        // Send notifications
        const receipts = await expo.sendPushNotificationsAsync(chunk);
        console.log("\nNotifications sent:", receipts);

        // Log which tokens were in this chunk
        chunk.forEach((msg, index) => {
          console.log(`\nDevice ${index + 1}:`);
          console.log(`Token: ${msg.to}`);
          console.log(`Result: ${JSON.stringify(receipts[index], null, 2)}`);
        });

        // Collect receipt IDs
        const receiptIds = receipts.map((receipt) => receipt.id).filter(Boolean);

        if (receiptIds.length > 0) {
          console.log("\nReceipt IDs to check:", receiptIds);

          // Delay to make sure receipts are processed
          await delay(5000);

          // Fetch receipt statuses
          const receiptResponse = await expo.getPushNotificationReceiptsAsync(receiptIds);
          console.log("\nReceipt Response:", receiptResponse);

          // Log details for each receipt
          Object.entries(receiptResponse).forEach(([receiptId, receipt]) => {
            const token = chunk[receiptIds.indexOf(receiptId)].to;
            console.log(`\nStatus for device with token ${token}:`);
            if (receipt.status === "ok") {
              console.log(`✓ Notification delivered successfully (Receipt ID: ${receiptId})`);
            } else {
              console.error(`✗ Delivery failed:`, receipt.message, receipt.details);
              
              // Handle invalid tokens
              if (receipt.details?.error === "DeviceNotRegistered") {
                console.log(`Removing invalid token: ${token}`);
                admin.firestore().collection("users").doc(TEST_USER_ID).update({
                  expoPushTokens: admin.firestore.FieldValue.arrayRemove(token)
                });
              }
            }
          });
        } else {
          console.log("No valid receipt IDs returned.");
        }
      } catch (error) {
        console.error("Error sending notification or fetching receipts:", error);
      }
    }
  } catch (error) {
    console.error("Error accessing Firestore:", error);
  }
};

sendNotification();
