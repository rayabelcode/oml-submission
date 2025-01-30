import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Expo } from 'expo-server-sdk';
import { SchedulingService } from '../src/utils/scheduler/scheduler.js';

const app = initializeApp();
const db = getFirestore();
const expo = new Expo();

// Test function that sends to my device once per day at 10:20 AM Eastern Time
export const scheduledNotification = onSchedule(
    {
        schedule: '20 10 * * *',
        timeZone: 'America/New_York', // Local time zone
    },
    async (event) => {
        console.log('Running test notification function...');
        const TEST_USER_ID = 'LTQ2OSK61lTjRdyqF9qXn94HW0t1'; // Ray's User ID

        try {
            const userDoc = await db.collection('users').doc(TEST_USER_ID).get();

            if (!userDoc.exists) {
                console.log('Test user not found');
                return null;
            }

            const userData = userDoc.data();
            console.log('Processing test notification for:', {
                username: userData.username,
                tokens: userData.expoPushTokens,
            });

            if (!userData.expoPushTokens || !userData.expoPushTokens.length) {
                console.log('No valid Expo push tokens found for test user');
                return null;
            }

            const messages = userData.expoPushTokens.map((token) => ({
                to: token,
                sound: 'default',
                title: 'Daily Test Notification',
                body: `Hello ${userData.first_name}! This is your daily test notification.`,
                data: {
                    type: 'TEST',
                    timestamp: new Date().toISOString(),
                },
            }));

            const chunks = expo.chunkPushNotifications(messages);
            for (const chunk of chunks) {
                try {
                    const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                    console.log('Test notifications sent:', {
                        username: userData.username,
                        result: ticketChunk,
                    });

                    ticketChunk.forEach(async (ticket, index) => {
                        if (
                            ticket.status === 'error' &&
                            ticket.details &&
                            ticket.details.error === 'DeviceNotRegistered'
                        ) {
                            const invalidToken = userData.expoPushTokens[index];
                            console.log('Removing invalid token:', invalidToken);
                            await db
                                .collection('users')
                                .doc(TEST_USER_ID)
                                .update({
                                    expoPushTokens: FieldValue.arrayRemove(invalidToken),
                                });
                        }
                    });
                } catch (error) {
                    console.error('Error sending test notifications:', {
                        username: userData.username,
                        error: error.message,
                    });
                }
            }

            return null;
        } catch (error) {
            console.error('Error in test function:', error);
            return null;
        }
    }
);

// Function to process reminders and send notifications
export const processReminders = onSchedule(
    {
        schedule: '* * * * *', // Check every minute
        timeZone: 'America/New_York',
    },
    async (event) => {
        console.log('Checking for due reminders...');

        try {
            const now = Timestamp.now();
            const endTime = Timestamp.fromMillis(now.toMillis() + 5 * 60 * 1000);

            // Query to handle time window filtering
            const remindersSnapshot = await db
                .collection('reminders')
                .where('scheduledTime', '<=', endTime)
                .where('notified', '==', false)
                .where('type', '==', 'SCHEDULED')
                .where('status', '==', 'pending')
                .where('snoozed', '==', false)
                .get();

            console.log(`Found ${remindersSnapshot.size} reminders to process`);

            for (const reminderDoc of remindersSnapshot.docs) {
                const reminder = reminderDoc.data();

                const userDoc = await db.collection('users').doc(reminder.user_id).get();

                if (!userDoc.exists || !userDoc.data().expoPushTokens || !userDoc.data().expoPushTokens.length) {
                    console.log(`No valid tokens for user ${reminder.user_id}`);
                    continue;
                }

                const userData = userDoc.data();
                const messages = userData.expoPushTokens.map((token) => ({
                    to: token,
                    sound: 'default',
                    title: 'Scheduled Call',
                    body: `Time to call ${reminder.contactName}`,
                    data: {
                        type: 'SCHEDULED',
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
                        console.log('Notifications sent:', {
                            userId: reminder.user_id,
                            reminderId: reminderDoc.id,
                            result: ticketChunk,
                        });

                        notificationSent = ticketChunk.some((ticket) => ticket.status === 'ok');

                        // Handle invalid tokens
                        ticketChunk.forEach(async (ticket, index) => {
                            if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
                                const invalidToken = userData.expoPushTokens[index];
                                console.log('Removing invalid token:', invalidToken);
                                await db
                                    .collection('users')
                                    .doc(reminder.user_id)
                                    .update({
                                        expoPushTokens: FieldValue.arrayRemove(invalidToken),
                                    });
                            }
                        });
                    } catch (error) {
                        console.error('Error sending notifications:', error);
                    }
                }

                // Only mark as notified if at least one notification was sent successfully
                if (notificationSent) {
                    const batch = db.batch();

                    // Update reminder as notified and completed
                    batch.update(reminderDoc.ref, {
                        notified: true,
                        status: 'completed',
                        completion_time: FieldValue.serverTimestamp(),
                        notifiedAt: FieldValue.serverTimestamp(),
                    });

                    // Update contact's next_contact if it matches this reminder's scheduled time
                    const contactRef = db.collection('contacts').doc(reminder.contact_id);
                    const contactDoc = await contactRef.get();
                    if (contactDoc.exists) {
                        const contactData = contactDoc.data();
                        const reminderTime = reminder.scheduledTime.toDate().getTime();
                        const nextContactTime = contactData.next_contact
                            ? new Date(contactData.next_contact).getTime()
                            : null;

                        if (nextContactTime === reminderTime) {
                            const updates = {
                                last_contacted: FieldValue.serverTimestamp(),
                                last_updated: FieldValue.serverTimestamp(),
                            };

                            // Clear the specific date that matched (either recurring or custom)
                            if (contactData.scheduling?.recurring_next_date) {
                                const recurringTime = new Date(contactData.scheduling.recurring_next_date).getTime();
                                if (recurringTime === reminderTime) {
                                    updates['scheduling.recurring_next_date'] = null;
                                }
                            }
                            if (contactData.scheduling?.custom_next_date) {
                                const customTime = new Date(contactData.scheduling.custom_next_date).getTime();
                                if (customTime === reminderTime) {
                                    updates['scheduling.custom_next_date'] = null;
                                }
                            }

                            // Set next_contact to whichever date remains (if any)
                            if (contactData.scheduling?.recurring_next_date || contactData.scheduling?.custom_next_date) {
                                const remaining = [
                                    contactData.scheduling?.recurring_next_date,
                                    contactData.scheduling?.custom_next_date,
                                ]
                                    .filter(Boolean)
                                    .map((date) => new Date(date));

                                updates.next_contact =
                                    remaining.length > 0 ? new Date(Math.min(...remaining.map((d) => d.getTime()))) : null;
                            } else {
                                updates.next_contact = null;
                            }

                            batch.update(contactRef, updates);
                        }
                    }

                    // Commit all updates in a single batch
                    await batch.commit();

                    console.log('Updated reminder and contact:', {
                        reminderId: reminderDoc.id,
                        contactId: reminder.contact_id,
                        status: 'completed',
                    });
                }
            }

            return null;
        } catch (error) {
            console.error('Error processing reminders:', error);
            return null;
        }
    }
);

// Test function to test scheduling
export const calculateNextDate = onSchedule(
    {
        schedule: '* * * * *',
        timeZone: 'America/New_York',
    },
    async (event) => {
        try {
            // Test basic scheduling first
            const scheduler = new SchedulingService(
                {}, // minimal user preferences
                [], // no existing reminders
                'UTC', // use UTC timezone
                { isCloudFunction: true }
            );

            // Test calculation
            const lastContactDate = new Date();
            const frequency = 'weekly';
            const nextDate = scheduler.calculatePreliminaryDate(lastContactDate, frequency);

            console.log('Test scheduling result:', {
                lastContactDate,
                frequency,
                nextDate,
            });

            return null;
        } catch (error) {
            console.error('Error in calculateNextDate:', error);
            return null;
        }
    }
);
