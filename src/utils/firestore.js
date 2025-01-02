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
	writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth } from '../config/firebase';
import { createContactData, updateContactData, SCHEDULING_CONSTANTS } from './contactHelpers';

// User functions
export const createUserDocument = async (userId, userData) => {
	try {
		await setDoc(doc(db, 'users', userId), {
			...userData,
			first_name: userData.first_name || '',
			last_name: userData.last_name || '',
			created_at: serverTimestamp(),
			notifications_enabled: true,
			photo_url: null,
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
		const docRef = await addDoc(contactsRef, contactData);
		return { id: docRef.id, ...contactData };
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
		console.error('Error details:', error.message);
		return null;
	}
};

export const fetchContacts = async (userId) => {
	try {
		const contactsRef = collection(db, 'contacts');
		// Change query to handle contacts without archived field
		const q = query(contactsRef, where('user_id', '==', userId), orderBy('first_name'), orderBy('last_name'));

		const querySnapshot = await getDocs(q);
		const contacts = [];

		querySnapshot.forEach((doc) => {
			const contactData = doc.data();
			// Include contact if archived is false or undefined
			if (!contactData.archived) {
				contacts.push({ id: doc.id, ...contactData });
			}
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

// Archive contact
export const archiveContact = async (contactId) => {
	try {
		const contactRef = doc(db, 'contacts', contactId);
		await updateDoc(contactRef, {
			archived: true,
			last_updated: serverTimestamp(),
		});
	} catch (error) {
		console.error('Error archiving contact:', error);
		throw error;
	}
};

export const updateContact = async (contactId, updateData) => {
	try {
		const contactRef = doc(db, 'contacts', contactId);
		const updates = updateContactData(updateData);

		// If notes are being updated, get existing contact first
		if ('notes' in updateData) {
			const contactSnapshot = await getDoc(contactRef);
			if (contactSnapshot.exists()) {
				// Preserve other fields while updating notes
				const existingData = contactSnapshot.data();
				updates.notes = updateData.notes;
				updates.last_updated = serverTimestamp();
			}
		}

		await updateDoc(contactRef, updates);
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

export async function updateContactScheduling(contactId, schedulingData) {
	try {
		const contactRef = doc(db, 'contacts', contactId);
		const defaultScheduling = {
			relationship_type: SCHEDULING_CONSTANTS.RELATIONSHIP_TYPES[0],
			frequency: SCHEDULING_CONSTANTS.FREQUENCIES.WEEKLY,
			custom_schedule: false,
			custom_preferences: {
				preferred_days: [],
				active_hours: {
					start: '09:00',
					end: '17:00',
				},
				excluded_times: [],
			},
			priority: SCHEDULING_CONSTANTS.PRIORITIES.NORMAL,
			minimum_gap: 30,
		};

		await updateDoc(contactRef, {
			scheduling: {
				...defaultScheduling,
				...schedulingData,
				updated_at: serverTimestamp(),
			},
		});
	} catch (error) {
		console.error('Error updating contact scheduling:', error);
		throw error;
	}
}

export async function updateNextContact(contactId, nextContactDate, options = {}) {
	try {
		const contactRef = doc(db, 'contacts', contactId);

		const updateData = {
			next_contact: nextContactDate ? nextContactDate.toISOString() : null,
			last_updated: serverTimestamp(),
		};

		if (options.lastContacted) {
			updateData.last_contacted = serverTimestamp();
		}

		await updateDoc(contactRef, updateData);

		if (nextContactDate) {
			await addReminder({
				contactId: contactId,
				scheduledTime: nextContactDate,
				type: 'regular',
				userId: auth.currentUser.uid,
				notes: '',
			});
		}
	} catch (error) {
		console.error('Error updating next contact:', error);
		throw error;
	}
}

// Function to fetch all reminders for a user
export async function fetchReminders(userId) {
	try {
		const remindersRef = collection(db, 'reminders');
		const q = query(
			remindersRef,
			where('user_id', '==', userId),
			where('snoozed', '==', false),
			orderBy('date')
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
}

// Follow up reminders
export async function createFollowUpReminder(contactId, date) {
	try {
		const remindersRef = collection(db, 'reminders');
		await addDoc(remindersRef, {
			contact_id: contactId,
			date: date,
			created_at: serverTimestamp(),
			updated_at: serverTimestamp(),
			snoozed: false,
			follow_up: true,
			type: 'follow_up',
			notes_required: true,
			user_id: auth.currentUser.uid,
		});
	} catch (error) {
		console.error('Error creating follow-up reminder:', error);
		throw error;
	}
}

// V2 reminder functions
export const addReminder = async (reminderData) => {
	try {
		const remindersRef = collection(db, 'reminders');

		// Create base reminder data with required fields
		const reminderDoc = {
			created_at: serverTimestamp(),
			updated_at: serverTimestamp(),
			contact_id: reminderData.contactId,
			user_id: auth.currentUser.uid,
			userId: auth.currentUser.uid, // Keep both for backward compatibility
			date: reminderData.scheduledTime,
			scheduledTime: reminderData.scheduledTime,
			status: reminderData.status || 'pending',
			type: reminderData.type || 'follow_up',
			snoozed: false,
			follow_up: reminderData.type === 'follow_up',
			completed: false,
			completion_time: null,
			notes_added: false,
			contactName: reminderData.contactName || '',
		};

		// Add optional fields only if they exist
		if (reminderData.call_data) {
			reminderDoc.call_data = reminderData.call_data;
		}

		const docRef = await addDoc(remindersRef, reminderDoc);
		return docRef.id;
	} catch (error) {
		console.error('[Firestore] Error adding reminder:', error);
		throw error;
	}
};

export const updateReminder = async (reminderId, updateData) => {
	try {
		const reminderRef = doc(db, 'reminders', reminderId);
		await updateDoc(reminderRef, {
			...updateData,
			updated_at: serverTimestamp(),
		});
		return true;
	} catch (error) {
		console.error('Error updating reminder:', error);
		throw error;
	}
};

export const deleteReminder = async (reminderId) => {
	try {
		const reminderRef = doc(db, 'reminders', reminderId);
		await deleteDoc(reminderRef);
		return true;
	} catch (error) {
		console.error('Error deleting reminder:', error);
		throw error;
	}
};

export const getReminder = async (reminderId) => {
	try {
		const reminderRef = doc(db, 'reminders', reminderId);
		const reminderSnap = await getDoc(reminderRef);

		if (!reminderSnap.exists()) {
			throw new Error('Reminder not found');
		}

		return {
			id: reminderSnap.id,
			...reminderSnap.data(),
		};
	} catch (error) {
		console.error('Error getting reminder:', error);
		throw error;
	}
};

export const getReminders = async (userId, status = 'pending') => {
	try {
		const remindersRef = collection(db, 'reminders');
		const q = query(
			remindersRef,
			where('userId', '==', userId),
			where('status', '==', status),
			orderBy('date', 'desc')
		);

		const snapshot = await getDocs(q);

		const reminders = snapshot.docs.map((doc) => {
			const data = doc.data();

			// Handle date conversion safely
			let scheduledTime;
			try {
				if (data.date?.toDate) {
					scheduledTime = data.date.toDate();
				} else if (data.scheduledTime?.toDate) {
					scheduledTime = data.scheduledTime.toDate();
				} else if (data.date) {
					scheduledTime = new Date(data.date);
				} else if (data.scheduledTime) {
					scheduledTime = new Date(data.scheduledTime);
				} else {
					scheduledTime = new Date();
				}
			} catch (error) {
				console.error('[Firestore] Error converting date:', error);
				scheduledTime = new Date();
			}

			return {
				id: doc.id,
				...data,
				scheduledTime,
				contactName: data.contactName || 'Unknown Contact',
				// Make sure all required fields are present
				contact_id: data.contact_id || data.contactId,
				call_data: data.call_data || null,
				type: data.type || 'regular',
			};
		});

		return reminders;
	} catch (error) {
		console.error('[Firestore] Error getting reminders:', error);
		throw error;
	}
};

export const getContactReminders = async (contactId, userId) => {
	try {
		const remindersRef = collection(db, 'reminders');
		const q = query(
			remindersRef,
			where('contact_id', '==', contactId),
			where('user_id', '==', userId),
			where('snoozed', '==', false)
		);

		const querySnapshot = await getDocs(q);
		const reminders = [];

		querySnapshot.forEach((doc) => {
			reminders.push({
				id: doc.id,
				...doc.data(),
			});
		});

		return reminders;
	} catch (error) {
		console.error('Error getting contact reminders:', error);
		throw error;
	}
};

// Follow up functions
export const getFollowUpReminders = async (userId) => {
	try {
		const remindersRef = collection(db, 'reminders');
		const q = query(
			remindersRef,
			where('user_id', '==', userId),
			where('type', '==', 'follow_up'),
			where('completed', '==', false),
			orderBy('date', 'desc')
		);

		const querySnapshot = await getDocs(q);
		return querySnapshot.docs.map((doc) => ({
			id: doc.id,
			...doc.data(),
		}));
	} catch (error) {
		console.error('Error fetching follow-up reminders:', error);
		throw error;
	}
};

export const completeFollowUp = async (reminderId, notes) => {
	try {
		const reminderRef = doc(db, 'reminders', reminderId);
		const reminderDoc = await getDoc(reminderRef);

		if (!reminderDoc.exists()) {
			throw new Error('Reminder not found');
		}

		const reminderData = reminderDoc.data();

		if (reminderData.user_id !== auth.currentUser?.uid) {
			throw new Error('User does not have permission to modify this reminder');
		}

		const batch = writeBatch(db);

		// Always update the reminder status
		batch.update(reminderRef, {
			completed: true,
			completion_time: serverTimestamp(),
			notes_added: !!notes,
			updated_at: serverTimestamp(),
			notes: notes || '',
			status: 'completed',
		});

		// Only add to contact history if notes were provided
		if (notes && reminderData.contact_id) {
			const contactRef = doc(db, 'contacts', reminderData.contact_id);
			const contactDoc = await getDoc(contactRef);

			if (contactDoc.exists()) {
				const contactData = contactDoc.data();
				const history = contactData.contact_history || [];

				const newHistoryEntry = {
					date: new Date().toISOString(),
					notes: notes,
					type: 'follow_up',
					completed: true,
				};

				batch.update(contactRef, {
					contact_history: [newHistoryEntry, ...history],
					last_updated: serverTimestamp(),
				});
			}
		}

		await batch.commit();
		return true;
	} catch (error) {
		console.error('Error completing follow-up:', error);
		throw error;
	}
};

// User profile functions
export const updateUserProfile = async (userId, profileData) => {
	try {
		const userRef = doc(db, 'users', userId);
		await updateDoc(userRef, {
			...profileData,
			last_updated: serverTimestamp(),
		});
	} catch (error) {
		console.error('Error updating user profile:', error);
		throw error;
	}
};

// Username check
export const checkUsernameExists = async (username, currentUserId) => {
	try {
		const usersRef = collection(db, 'users');
		const q = query(usersRef, where('username', '==', username.toLowerCase()));
		const querySnapshot = await getDocs(q);

		// Check if any user other than the current user has this username
		return querySnapshot.docs.some((doc) => doc.id !== currentUserId);
	} catch (error) {
		console.error('Error checking username:', error);
		throw error;
	}
};

export const getUserProfile = async (userId) => {
	try {
		const userRef = doc(db, 'users', userId);
		const userSnap = await getDoc(userRef);

		if (!userSnap.exists()) {
			// Create default user profile if it doesn't exist
			const defaultProfile = {
				created_at: serverTimestamp(),
				notifications_enabled: true,
				email: userId,
				photo_url: null,
				first_name: '',
				last_name: '',
			};
			await setDoc(userRef, defaultProfile);
			return defaultProfile;
		}
		return userSnap.data();
	} catch (error) {
		console.error('Error fetching user profile:', error);
		throw error;
	}
};

// Upload profile photo
export const uploadProfilePhoto = async (userId, photoUri) => {
	try {
		if (!photoUri) return null;

		const response = await fetch(photoUri);
		const blob = await response.blob();

		const filename = `profiles/${userId}/${Date.now()}.jpg`;
		const storageRef = ref(storage, filename);

		await uploadBytes(storageRef, blob);
		const downloadURL = await getDownloadURL(storageRef);

		// Update user profile with new photo URL
		await updateUserProfile(userId, { photo_url: downloadURL });

		return downloadURL;
	} catch (error) {
		console.error('Error uploading profile photo:', error);
		return null;
	}
};

// Export user data
export const exportUserData = async (userId) => {
	try {
		// Get user profile
		const userProfile = await getUserProfile(userId);

		// Get all user contacts
		const contactsRef = collection(db, 'contacts');
		const q = query(contactsRef, where('user_id', '==', userId));
		const querySnapshot = await getDocs(q);

		const contacts = [];
		querySnapshot.forEach((doc) => {
			contacts.push({ id: doc.id, ...doc.data() });
		});

		return {
			profile: userProfile,
			contacts: contacts,
		};
	} catch (error) {
		console.error('Error exporting user data:', error);
		throw error;
	}
};

// Delete user account and data
export const deleteUserAccount = async (userId) => {
	try {
		// Delete all contacts
		const contactsRef = collection(db, 'contacts');
		const q = query(contactsRef, where('user_id', '==', userId));
		const querySnapshot = await getDocs(q);

		const batch = writeBatch(db);
		querySnapshot.forEach((doc) => {
			batch.delete(doc.ref);
		});

		// Delete user profile
		const userRef = doc(db, 'users', userId);
		batch.delete(userRef);

		await batch.commit();
	} catch (error) {
		console.error('Error deleting user account:', error);
		throw error;
	}
};
