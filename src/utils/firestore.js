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
	getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// User doc creation
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

// Contact functions
export const addContact = async (userId, contactData) => {
	console.log('Adding contact for user:', userId);
	try {
		const contactsRef = collection(db, 'contacts');
		const newContact = {
			...contactData,
			user_id: userId,
			created_at: serverTimestamp(),
			last_contact: null,
			last_updated: serverTimestamp(),
		};

		console.log('Creating contact with data:', newContact);
		const docRef = await addDoc(contactsRef, newContact);
		console.log('Contact created with ID:', docRef.id);
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
	console.log('A. Starting delete in Firestore for ID:', contactId);
	try {
		const contactRef = doc(db, 'contacts', contactId);
		console.log('B. Contact reference created');
		const contactSnap = await getDoc(contactRef);
		console.log('C. Document data:', contactSnap.data());
		await deleteDoc(contactRef);
		console.log('D. Delete completed in Firestore');
	} catch (error) {
		console.error('Firestore delete error:', {
			code: error.code,
			message: error.message,
		});
		throw error;
	}
};

// Reminder functions
export const addReminder = async (userId, reminderData) => {
	try {
		const remindersRef = collection(db, 'reminders');
		const newReminder = {
			...reminderData,
			user_id: userId,
			completed: false,
			created_at: serverTimestamp(),
			last_updated: serverTimestamp(),
			due_date:
				reminderData.due_date instanceof Date ? reminderData.due_date.toISOString() : reminderData.due_date,
		};

		if (reminderData.contact_id) {
			const contactRef = doc(db, 'contacts', reminderData.contact_id);
			const contactSnap = await getDoc(contactRef);
			if (contactSnap.exists()) {
				newReminder.contact = {
					id: contactSnap.id,
					name: contactSnap.data().name,
				};
			}
		}

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
			const data = doc.data();
			reminders.push({
				id: doc.id,
				...data,
				due_date: data.due_date instanceof Date ? data.due_date : new Date(data.due_date),
			});
		});

		return reminders.sort((a, b) => a.due_date - b.due_date);
	} catch (error) {
		console.error('Error fetching reminders:', error);
		throw error;
	}
};

export const completeReminder = async (reminderId) => {
	try {
		const reminderRef = doc(db, 'reminders', reminderId);
		const reminderSnap = await getDoc(reminderRef);

		if (!reminderSnap.exists()) {
			throw new Error('Reminder not found');
		}

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

export const deleteReminder = async (reminderId) => {
	try {
		const reminderRef = doc(db, 'reminders', reminderId);
		await deleteDoc(reminderRef);
	} catch (error) {
		console.error('Error deleting reminder:', error);
		throw error;
	}
};

export const updateReminder = async (reminderId, reminderData) => {
	try {
		const reminderRef = doc(db, 'reminders', reminderId);
		const updateData = {
			...reminderData,
			last_updated: serverTimestamp(),
			due_date:
				reminderData.due_date instanceof Date ? reminderData.due_date.toISOString() : reminderData.due_date,
		};

		if (reminderData.contact_id) {
			const contactRef = doc(db, 'contacts', reminderData.contact_id);
			const contactSnap = await getDoc(contactRef);
			if (contactSnap.exists()) {
				updateData.contact = {
					id: contactSnap.id,
					name: contactSnap.data().name,
				};
			}
		}

		await updateDoc(reminderRef, updateData);
	} catch (error) {
		console.error('Error updating reminder:', error);
		throw error;
	}
};
