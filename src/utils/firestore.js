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
import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
			first_name: contactData.first_name || '',
			last_name: contactData.last_name || '',
			photo_url: contactData.photo_url || null,
			notes: contactData.notes || '',
			contact_history: [],
			tags: [],
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

// Upload contact photo
export const uploadContactPhoto = async (userId, photoUri) => {
	try {
		if (!photoUri) return null;

		// Create blob from URI
		const response = await fetch(photoUri);
		const blob = await response.blob();

		// Create unique filename
		const filename = `contacts/${userId}/${Date.now()}.jpg`;
		const storageRef = ref(storage, filename);

		// Upload photo
		await uploadBytes(storageRef, blob);

		// Get download URL
		const downloadURL = await getDownloadURL(storageRef);
		return downloadURL;
	} catch (error) {
		console.error('Error uploading photo:', error);
		return null;
	}
};

export const fetchContacts = async (userId) => {
	try {
		const contactsRef = collection(db, 'contacts');
		const q = query(contactsRef, where('user_id', '==', userId), orderBy('first_name'), orderBy('last_name'));

		const querySnapshot = await getDocs(q);
		const contacts = [];

		querySnapshot.forEach((doc) => {
			contacts.push({ id: doc.id, ...doc.data() });
		});

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

export const addContactHistory = async (contactId, historyData) => {
	try {
		const contactRef = doc(db, 'contacts', contactId);
		const newHistoryEntry = {
			date: historyData.date || new Date().toISOString(),
			notes: historyData.notes || '',
			completed: true,
		};

		// Get current history first
		const contactDoc = await getDoc(contactRef);
		const currentHistory = contactDoc.data().contact_history || [];

		// Add new entry at beginning of array
		const updatedHistory = [newHistoryEntry, ...currentHistory];

		// Update with new history array
		await updateDoc(contactRef, {
			contact_history: updatedHistory,
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
		const history = data.contact_history || [];

		// Convert timestamps and sort
		return history
			.map((entry) => ({
				...entry,
				date: entry.date, // Keep the ISO string format
			}))
			.sort((a, b) => new Date(b.date) - new Date(a.date));
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
