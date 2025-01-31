import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';
import { https } from 'firebase-functions';

const app = initializeApp({
    projectId: 'onmylist-app'
});

const db = getFirestore();
// Connect to Firestore emulator (http://127.0.0.1:4000/firestore)
db.settings({
    host: 'localhost:8080',
    ssl: false
});

const TEST_USER_ID = 'LTQ2OSK61lTjRdyqF9qXn94HW0t1'; // Ray's User ID

async function createTestNotification() {
    try {
        // Create test reminder for now (immediate processing)
        const reminderData = {
            scheduledTime: new Date(), // Schedule for now
            notified: false,
            type: 'SCHEDULED',
            status: 'pending',
            snoozed: false,
            contactName: 'Test Contact',
            contact_id: 'test-contact-id',
            user_id: TEST_USER_ID
        };

        const reminderRef = await db.collection('reminders').add(reminderData);
        console.log('Test reminder created:', reminderRef.id);
        console.log('Scheduled for:', reminderData.scheduledTime);
        
        // Manually trigger the processReminders function
        console.log('Triggering processReminders function...');
        
        // Make HTTP request to test endpoint
        const response = await fetch('http://127.0.0.1:5001/onmylist-app/us-central1/testScheduler');
        const result = await response.json();
        console.log('Function response:', result);

        // Check reminder status after processing
        console.log('Checking final reminder status...');
        const updatedReminder = await reminderRef.get();
        console.log('Final status:', updatedReminder.data().status);
        console.log('Notified:', updatedReminder.data().notified);
        
        process.exit(0);
    } catch (error) {
        console.error('Error in test:', error);
        process.exit(1);
    }
}

createTestNotification();
