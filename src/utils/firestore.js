import {
	collection,
	query,
	where,
	orderBy,
	getDocs,
	addDoc,
	updateDoc,
	deleteDoc,
	doc,
	setDoc,
	serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// User operations
export const createUserDocument = async (userId, userData) => {
	try {
		await setDoc(doc(db, 'users', userId), {
			...userData,
			created_at: serverTimestamp(),
			settings: {
				notifications_enabled: true,
				reminder_frequency_default: 'weekly',
			},
		});
	} catch (error) {
		console.error('Error creating user document:', error);
		throw error;
	}
};

// Contact operations
export const addContact = async (userId, contactData) => {
	try {
		const contactsRef = collection(db, 'contacts');
		const newContact = {
			...contactData,
			user_id: userId,
			created_at: serverTimestamp(),
			last_contact: null,
			last_updated: serverTimestamp(),
		};

		const docRef = await addDoc(contactsRef, newContact);
		return { id: docRef.id, ...newContact };
	} catch (error) {
		console.error('Error adding contact:', error);
		throw error;
	}
};

export const fetchContacts = async (userId, searchQuery = '') => {
	try {
		const contactsRef = collection(db, 'contacts');
		const q = query(contactsRef, where('user_id', '==', userId), orderBy('name'));

		const querySnapshot = await getDocs(q);
		const contacts = [];

		querySnapshot.forEach((doc) => {
			contacts.push({ id: doc.id, ...doc.data() });
		});

		if (searchQuery) {
			return contacts.filter((contact) => contact.name.toLowerCase().includes(searchQuery.toLowerCase()));
		}

		return contacts;
	} catch (error) {
		console.error('Error fetching contacts:', error);
		throw error;
	}
};

export const deleteContact = async (contactId) => {
	try {
		await deleteDoc(doc(db, 'contacts', contactId));
	} catch (error) {
		console.error('Error deleting contact:', error);
		throw error;
	}
};

// Reminder operations
export const addReminder = async (userId, reminderData) => {
	try {
		const remindersRef = collection(db, 'reminders');
		const newReminder = {
			...reminderData,
			user_id: userId,
			completed: false,
			created_at: serverTimestamp(),
			last_updated: serverTimestamp(),
		};

		const docRef = await addDoc(remindersRef, newReminder);
		return { id: docRef.id, ...newReminder };
	} catch (error) {
		console.error('Error adding reminder:', error);
		throw error;
	}
};

export const fetchReminders = async (userId) => {
	try {
		const remindersRef = collection(db, 'reminders');
		const q = query(
			remindersRef,
			where('user_id', '==', userId),
			where('completed', '==', false),
			orderBy('due_date')
		);

		const querySnapshot = await getDocs(q);
		const reminders = [];

		querySnapshot.forEach((doc) => {
			reminders.push({ id: doc.id, ...doc.data() });
		});

		return reminders;
	} catch (error) {
		console.error('Error fetching reminders:', error);
		throw error;
	}
};

export const completeReminder = async (reminderId) => {
	try {
		const reminderRef = doc(db, 'reminders', reminderId);
		await updateDoc(reminderRef, {
			completed: true,
			completed_at: serverTimestamp(),
			last_updated: serverTimestamp(),
		});
	} catch (error) {
		console.error('Error completing reminder:', error);
		throw error;
	}
};
