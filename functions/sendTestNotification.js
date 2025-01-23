const { Expo } = require("expo-server-sdk");

// New Expo SDK client
const expo = new Expo();

// Add a delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sendNotification = async () => {
  const pushToken = "ExponentPushToken[c6f3CxHcM9FZdy8be1wRuX]"; // Push token from Expo

  const messages = [{
    to: pushToken,
    sound: "default",
    title: "Hello, Ray!",
    body: "Your notification has been delivered successfully!",
    data: { extraData: "testValue" },
  }];

  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      // Send notifications
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      console.log("Notification sent:", receipts);

      // Collect receipt IDs
      const receiptIds = receipts.map((receipt) => receipt.id).filter(Boolean);

      if (receiptIds.length > 0) {
        console.log("Receipt IDs to check:", receiptIds);

        // Add delay to make sure receipts are processed
        await delay(5000);

        // Fetch receipt statuses
        const receiptResponse = await expo.getPushNotificationReceiptsAsync(receiptIds);
        console.log("Receipt Response:", receiptResponse);

        // Log details for each receipt
        Object.keys(receiptResponse).forEach((receiptId) => {
          if (Object.prototype.hasOwnProperty.call(receiptResponse, receiptId)) {
            const { status, message, details } = receiptResponse[receiptId];
            if (status === "ok") {
              console.log(`Notification with receipt ID ${receiptId} was successfully delivered.`);
            } else {
              console.error(`Notification with receipt ID ${receiptId} failed:`, message, details);
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
};

sendNotification();
