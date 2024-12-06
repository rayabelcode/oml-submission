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
	arrayUnion,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// User functions
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
	try {
		const contactsRef = collection(db, 'contacts');
		const newContact = {
			...contactData,
			user_id: userId,
			photo_url: contactData.photo_url || null,
			notes: contactData.notes || '',
			contact_history: [],
			next_contact: null,
			created_at: serverTimestamp(),
			last_updated: serverTimestamp(),
		};

		const docRef = await addDoc(contactsRef, newContact);
		return { id: docRef.id, ...newContact };
	} catch (error) {
		console.error('Error adding contact:', error);
		throw error;
	}
};

export const fetchContacts = async (userId) => {
	try {
		const contactsRef = collection(db, 'contacts');
		const q = query(contactsRef, where('user_id', '==', userId), orderBy('name'));

		const querySnapshot = await getDocs(q);
		const contacts = [];

		querySnapshot.forEach((doc) => {
			contacts.push({ id: doc.id, ...doc.data() });
		});

		// Sort contacts by those with and without next_contact
		return {
			scheduledContacts: contacts.filter((contact) => contact.next_contact !== null),
			unscheduledContacts: contacts.filter((contact) => contact.next_contact === null),
		};
	} catch (error) {
		console.error('Error fetching contacts:', error);
		throw error;
	}
};

export const updateContact = async (contactId, updateData) => {
	try {
		const contactRef = doc(db, 'contacts', contactId);
		await updateDoc(contactRef, {
			...updateData,
			last_updated: serverTimestamp(),
		});
	} catch (error) {
		console.error('Error updating contact:', error);
		throw error;
	}
};

export const deleteContact = async (contactId) => {
	try {
		const contactRef = doc(db, 'contacts', contactId);
		await deleteDoc(contactRef);
	} catch (error) {
		console.error('Error deleting contact:', error);
		throw error;
	}
};

// Contact history functions
export const addContactHistory = async (contactId, historyData) => {
	try {
		const contactRef = doc(db, 'contacts', contactId);
		const newHistoryEntry = {
			date: new Date().toISOString(),
			notes: historyData.notes || '',
			completed: true,
		};

		// Append the new entry to the contact's history
		await updateDoc(contactRef, {
			contact_history: arrayUnion(newHistoryEntry),
			last_updated: serverTimestamp(),
		});

		return newHistoryEntry;
	} catch (error) {
		throw new Error('Error adding contact history: ' + error.message);
	}
};

export const fetchContactHistory = async (contactId) => {
	try {
		const contactRef = doc(db, 'contacts', contactId);
		const contactSnap = await getDoc(contactRef);

		if (!contactSnap.exists()) {
			throw new Error('Contact not found');
		}

		const data = contactSnap.data();
		return data.contact_history || [];
	} catch (error) {
		console.error('Error fetching contact history:', error);
		throw error;
	}
};

// Schedule functions
export const fetchUpcomingContacts = async (userId) => {
	try {
		const contactsRef = collection(db, 'contacts');

		const q = query(contactsRef, where('user_id', '==', userId), where('next_contact', '!=', null));

		const querySnapshot = await getDocs(q);
		const contacts = [];

		querySnapshot.forEach((doc) => {
			const data = doc.data();
			if (data.next_contact) {
				contacts.push({
					id: doc.id,
					...data,
				});
			}
		});

		return contacts;
	} catch (error) {
		console.error('Error fetching upcoming contacts:', error);
		throw error;
	}
};

export const fetchPastContacts = async (userId) => {
	try {
		const contactsRef = collection(db, 'contacts');
		const contacts = await fetchContacts(userId);

		return contacts.scheduledContacts
			.filter((contact) => contact.contact_history.length > 0)
			.map((contact) => ({
				...contact,
				contact_history: contact.contact_history.sort((a, b) => b.date - a.date),
			}));
	} catch (error) {
		console.error('Error fetching past contacts:', error);
		throw error;
	}
};
