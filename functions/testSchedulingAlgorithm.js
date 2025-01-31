import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';

const app = initializeApp();
const db = getFirestore();

const TEST_USER_ID = 'LTQ2OSK61lTjRdyqF9qXn94HW0t1'; // Ray's User ID

async function createTestData() {
    try {
        // Create test contact
        await db.collection('contacts').doc('test-contact-id').set({
            name: 'Test Contact',
            user_id: TEST_USER_ID,
            scheduling: {
                frequency: 'weekly'
            }
        });

        // Create test reminder (5 minutes from now)
        await db.collection('reminders').add({
            scheduledTime: new Date(Date.now() + 5 * 60 * 1000),
            notified: false,
            type: 'SCHEDULED',
            status: 'pending',
            snoozed: false,
            contactName: 'Test Contact',
            contact_id: 'test-contact-id',
            user_id: TEST_USER_ID
        });

        console.log('Test data created successfully');
    } catch (error) {
        console.error('Error creating test data:', error);
    }
}

createTestData();
