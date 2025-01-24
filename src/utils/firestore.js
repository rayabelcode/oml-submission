import {
	addDoc,
	arrayUnion,
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	onSnapshot,
	orderBy,
	query,
	setDoc,
	serverTimestamp,
	Timestamp,
	updateDoc,
	where,
	writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth } from '../config/firebase';
import { createContactData, updateContactData, SCHEDULING_CONSTANTS } from './contactHelpers';
import { cacheManager } from './cache';
import NetInfo from '@react-native-community/netinfo';
import { RELATIONSHIP_DEFAULTS } from '../../constants/relationships';
import { REMINDER_TYPES, REMINDER_STATUS } from '../../constants/notificationConstants';
import { SchedulingService } from './scheduler';

// Store active subscriptions
const activeSubscriptions = new Map();

// Helper function to clean up subscriptions
export const cleanupSubscriptions = () => {
	activeSubscriptions.forEach((unsubscribe) => unsubscribe());
	activeSubscriptions.clear();
};

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
			scheduling_preferences: {
				global_excluded_times: [
					{
						days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
						end: '07:00',
						start: '23:00',
					},
				],
				max_reminders_per_day: 5,
				minimumGapMinutes: 30,
				optimalGapMinutes: 120,
				relationship_types: RELATIONSHIP_DEFAULTS,
				scheduling_history: {
					enabled: true,
				},
				patterns: {},
				snooze_options: {
					default_options: [
						{
							hours: 3,
							label: 'Later Today',
						},
						{
							days: 1,
							label: 'Tomorrow',
						},
						{
							days: 7,
							label: 'Next Week',
						},
					],
					version: 2,
				},
			},
		});
	} catch (error) {
		console.error('Error creating user document:', error);
		throw error;
	}
};

// Contact functions with real-time capabilities
export const subscribeToContacts = (userId, callback) => {
	if (!userId) {
		console.error('No userId provided to subscribeToContacts');
		callback({ scheduledContacts: [], unscheduledContacts: [] });
		return () => {};
	}

	try {
		const contactsRef = collection(db, 'contacts');
		const q = query(contactsRef, where('user_id', '==', userId), orderBy('first_name'), orderBy('last_name'));

		// Try to get cached data first
		cacheManager.getCachedContacts(userId).then((cached) => {
			if (cached) {
				callback(cached);
			}
		});

		const unsubscribe = onSnapshot(
			q,
			async (querySnapshot) => {
				const contacts = [];
				querySnapshot.forEach((doc) => {
					const contactData = doc.data();
					if (!contactData.archived) {
						contacts.push({ id: doc.id, ...contactData });
					}
				});

				const formattedContacts = {
					scheduledContacts: contacts.filter((contact) => contact.next_contact),
					unscheduledContacts: contacts.filter((contact) => !contact.next_contact),
				};

				// Save to cache
				await cacheManager.saveContacts(userId, formattedContacts);
				callback(formattedContacts);
			},
			async (error) => {
				console.error('Contacts subscription error:', error);
				// Try to get cached data on error
				const cached = await cacheManager.getCachedContacts(userId);
				if (cached) {
					callback(cached);
				} else {
					callback({ scheduledContacts: [], unscheduledContacts: [] });
				}
			}
		);

		// Store the unsubscribe function
		activeSubscriptions.set(`contacts_${userId}`, unsubscribe);
		return unsubscribe;
	} catch (error) {
		console.error('Error setting up contacts subscription:', error);
		// Try to get cached data on setup error
		cacheManager.getCachedContacts(userId).then((cached) => {
			if (cached) {
				callback(cached);
			} else {
				callback({ scheduledContacts: [], unscheduledContacts: [] });
			}
		});
		return () => {};
	}
};

// Keep existing fetchContacts for backward compatibility and offline-first approach
export const fetchContacts = async (userId) => {
	try {
		const networkState = await NetInfo.fetch();

		if (!networkState.isConnected) {
			const cachedContacts = await cacheManager.getCachedContacts(userId);
			if (cachedContacts) {
				return cachedContacts;
			}
			throw new Error('No internet connection and no cached data available');
		}

		const contactsRef = collection(db, 'contacts');
		const q = query(contactsRef, where('user_id', '==', userId), orderBy('first_name'), orderBy('last_name'));

		const querySnapshot = await getDocs(q);
		const contacts = [];

		querySnapshot.forEach((doc) => {
			const contactData = doc.data();
			if (!contactData.archived) {
				contacts.push({ id: doc.id, ...contactData });
			}
		});

		const formattedContacts = {
			scheduledContacts: contacts.filter((contact) => contact.next_contact !== null),
			unscheduledContacts: contacts.filter((contact) => contact.next_contact === null),
		};

		await cacheManager.saveContacts(userId, formattedContacts);
		return formattedContacts;
	} catch (error) {
		console.error('Error fetching contacts:', error);
		const cachedContacts = await cacheManager.getCachedContacts(userId);
		if (cachedContacts) {
			return cachedContacts;
		}
		throw error;
	}
};

export const getContactById = async (contactId) => {
	try {
		const contactRef = doc(db, 'contacts', contactId);
		const contactSnap = await getDoc(contactRef);

		if (!contactSnap.exists()) {
			console.error('Contact not found:', contactId);
			return null;
		}

		return { id: contactSnap.id, ...contactSnap.data() };
	} catch (error) {
		console.error('Error getting contact by ID:', error);
		return null;
	}
};

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

export const uploadContactPhoto = async (userId, photoUri) => {
	try {
		if (!photoUri) return null;

		const response = await fetch(photoUri);
		const blob = await response.blob();
		const filename = `contacts/${userId}/${Date.now()}.jpg`;
		const storageRef = ref(storage, filename);

		await uploadBytes(storageRef, blob);
		const downloadURL = await getDownloadURL(storageRef);
		return downloadURL;
	} catch (error) {
		console.error('Error uploading photo:', error);
		console.error('Error details:', error.message);
		return null;
	}
};

// Archive, Update, Delete Contact Operations
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

		if ('notes' in updateData) {
			const contactSnapshot = await getDoc(contactRef);
			if (contactSnapshot.exists()) {
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

// Contact History Operations
export const addContactHistory = async (contactId, historyData) => {
	try {
		const contactRef = doc(db, 'contacts', contactId);
		const newHistoryEntry = {
			date: historyData.date || new Date().toISOString(),
			notes: historyData.notes || '',
			completed: true,
		};

		const contactDoc = await getDoc(contactRef);
		const currentHistory = contactDoc.data().contact_history || [];
		const updatedHistory = [newHistoryEntry, ...currentHistory];

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

		return history
			.map((entry) => ({
				...entry,
				date: entry.date,
			}))
			.sort((a, b) => new Date(b.date) - new Date(a.date));
	} catch (error) {
		console.error('Error fetching contact history:', error);
		throw error;
	}
};

// Real-time Contact Details Subscription
export const subscribeToContactDetails = (contactId, callback, onError) => {
	if (!contactId) {
		console.error('No contactId provided to subscribeToContactDetails');
		return () => {};
	}

	try {
		const contactRef = doc(db, 'contacts', contactId);

		const unsubscribe = onSnapshot(
			contactRef,
			(doc) => {
				if (!doc.exists()) {
					if (activeSubscriptions.has(`contact_${contactId}`)) {
						activeSubscriptions.get(`contact_${contactId}`)();
						activeSubscriptions.delete(`contact_${contactId}`);
					}
					return;
				}
				const contactData = { id: doc.id, ...doc.data() };
				callback(contactData);
			},
			(error) => {
				console.error('Contact subscription error:', error);
				onError && onError(error);
			}
		);

		if (activeSubscriptions.has(`contact_${contactId}`)) {
			activeSubscriptions.get(`contact_${contactId}`)();
		}
		activeSubscriptions.set(`contact_${contactId}`, unsubscribe);

		return unsubscribe;
	} catch (error) {
		console.error('Error setting up contact details subscription:', error);
		onError && onError(error);
		return () => {};
	}
};

// Schedule and Upcoming Contacts Operations
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

// Real-time Upcoming Contacts Subscription
export const subscribeToUpcomingContacts = (userId, callback) => {
	if (activeSubscriptions.has(`upcoming_${userId}`)) {
		activeSubscriptions.get(`upcoming_${userId}`)();
	}

	const contactsRef = collection(db, 'contacts');
	const q = query(contactsRef, where('user_id', '==', userId), where('next_contact', '!=', null));

	const unsubscribe = onSnapshot(
		q,
		(snapshot) => {
			const contacts = [];
			snapshot.forEach((doc) => {
				const data = doc.data();
				if (data.next_contact) {
					contacts.push({ id: doc.id, ...data });
				}
			});

			cacheManager.saveUpcomingContacts(userId, contacts);
			callback(contacts);
		},
		(error) => {
			console.error('Error in upcoming contacts subscription:', error);
			cacheManager.getCachedUpcomingContacts(userId).then((cached) => {
				if (cached) callback(cached);
			});
		}
	);

	activeSubscriptions.set(`upcoming_${userId}`, unsubscribe);
	return unsubscribe;
};

export const fetchPastContacts = async (userId) => {
	try {
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

// Scheduling Operations
export const getUserPreferences = async (userId) => {
	try {
		const userDoc = await getDoc(doc(db, 'users', userId));
		if (!userDoc.exists()) return null;
		return userDoc.data();
	} catch (error) {
		console.error('Error getting user preferences:', error);
		return null;
	}
};

export const getActiveReminders = async (userId) => {
	try {
		const remindersRef = collection(db, 'reminders');
		const q = query(
			remindersRef,
			where('user_id', '==', userId),
			where('status', '==', REMINDER_STATUS.PENDING)
		);
		const snapshot = await getDocs(q);
		return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
	} catch (error) {
		console.error('Error getting active reminders:', error);
		return [];
	}
};

export async function updateContactScheduling(contactId, schedulingData) {
	try {
		const batch = writeBatch(db);
		const contactRef = doc(db, 'contacts', contactId);
		const contactDoc = await getDoc(contactRef);
		const contact = contactDoc.data();

		let updateData = {
			scheduling: {
				...contact.scheduling,
				...schedulingData,
				updated_at: serverTimestamp(),
			},
		};

		if (schedulingData.frequency) {
			const userPrefs = await getUserPreferences(contact.user_id);
			const activeReminders = await getActiveReminders(contact.user_id);

			const schedulingService = new SchedulingService(
				userPrefs?.scheduling_preferences,
				activeReminders,
				Intl.DateTimeFormat().resolvedOptions().timeZone
			);

			const lastContactDate = contact.last_contacted?.toDate() || new Date();

			const reminderSchedule = await schedulingService.scheduleRecurringReminder(
				{ ...contact, id: contactId },
				lastContactDate,
				schedulingData.frequency
			);

			// Update with flattened structure
			updateData.scheduling = {
				...updateData.scheduling,
				frequency: schedulingData.frequency,
				pattern_adjusted: reminderSchedule.pattern_adjusted || false,
				...(reminderSchedule.confidence !== undefined && {
					confidence: reminderSchedule.confidence,
				}),
				recurring_next_date: reminderSchedule.recurring_next_date,
			};

			// Set next_contact based on scheduled date
			if (reminderSchedule.status !== 'SLOTS_FILLED') {
				updateData.next_contact = reminderSchedule.date;
			}
		}

		if ('custom_next_date' in schedulingData) {
			updateData.scheduling.custom_next_date = schedulingData.custom_next_date || null;
		}

		// Update next_contact based on available dates
		if (updateData.scheduling.custom_next_date && updateData.scheduling.recurring_next_date) {
			const recurring = new Date(updateData.scheduling.recurring_next_date);
			const custom = new Date(updateData.scheduling.custom_next_date);
			updateData.next_contact =
				recurring < custom
					? updateData.scheduling.recurring_next_date
					: updateData.scheduling.custom_next_date;
		} else {
			updateData.next_contact =
				updateData.scheduling.custom_next_date || updateData.scheduling.recurring_next_date || null;
		}

		batch.update(contactRef, updateData);

		// Handle reminder updates if there's a new next_contact date
		if (updateData.next_contact) {
			const existingReminders = await getContactReminders(contactId, auth.currentUser.uid);

			// Delete existing scheduled reminders - with existence check
			for (const reminder of existingReminders) {
				if (reminder.type === REMINDER_TYPES.SCHEDULED) {
					const reminderRef = doc(db, 'reminders', reminder.id);
					const reminderDoc = await getDoc(reminderRef);
					if (reminderDoc.exists()) {
						batch.delete(reminderRef);
					}
				}
			}

			// Create new reminder only if deletions successfully processed
			const newReminderRef = doc(collection(db, 'reminders'));
			const now = Timestamp.now();
			const scheduledTimestamp =
				updateData.next_contact instanceof Timestamp
					? updateData.next_contact
					: Timestamp.fromDate(new Date(updateData.next_contact));

			const reminderDoc = {
				created_at: now,
				updated_at: now,
				contact_id: contactId,
				user_id: auth.currentUser.uid,
				scheduledTime: scheduledTimestamp,
				status: REMINDER_STATUS.PENDING,
				type: REMINDER_TYPES.SCHEDULED,
				snoozed: false,
				needs_attention: false,
				completed: false,
				completion_time: null,
				notes_added: false,
				contactName: contact.first_name + ' ' + contact.last_name,
			};

			batch.set(newReminderRef, reminderDoc);
		}

		await batch.commit();

		const updatedContactDoc = await getDoc(contactRef);
		const updatedContact = updatedContactDoc.data();

		return { ...updatedContact, id: contactId };
	} catch (error) {
		console.error('Error in updateContactScheduling:', error);
		throw error;
	}
}

export async function updateNextContact(contactId, nextContactDate, options = {}) {
	try {
		const contactRef = doc(db, 'contacts', contactId);

		// 1. Update the contact's next_contact date
		const updateData = {
			next_contact: nextContactDate ? nextContactDate.toISOString() : null,
			last_updated: serverTimestamp(),
		};

		if (options.lastContacted) {
			updateData.last_contacted = serverTimestamp();
		}

		await updateDoc(contactRef, updateData);

		// 2. If there's an existing scheduled reminder, cancel it
		const existingReminders = await getContactReminders(contactId, auth.currentUser.uid);
		for (const reminder of existingReminders) {
			if (reminder.type === REMINDER_TYPES.SCHEDULED) {
				await deleteReminder(reminder.id);
			}
		}

		// 3. Only create a new reminder if nextContactDate exists
		if (nextContactDate) {
			await addReminder({
				contactId: contactId,
				scheduledTime: nextContactDate,
				type: REMINDER_TYPES.SCHEDULED,
				status: REMINDER_STATUS.PENDING,
				userId: auth.currentUser.uid,
				needs_attention: false,
				snoozed: false,
			});
		}
	} catch (error) {
		console.error('Error updating next contact:', error);
		throw error;
	}
}

// Reminder Operations
export const addReminder = async (reminderData) => {
	try {
		const remindersRef = collection(db, 'reminders');
		const now = Timestamp.now();
		const scheduledTimestamp =
			reminderData.scheduledTime instanceof Date
				? Timestamp.fromDate(reminderData.scheduledTime)
				: Timestamp.fromDate(new Date(reminderData.scheduledTime));

		const reminderDoc = {
			created_at: now,
			updated_at: now,
			contact_id: reminderData.contactId,
			user_id: auth.currentUser.uid,
			scheduledTime: scheduledTimestamp,
			status: reminderData.status || REMINDER_STATUS.PENDING,
			type: reminderData.type || REMINDER_TYPES.SCHEDULED,
			snoozed: false,
			needs_attention: reminderData.type === REMINDER_TYPES.FOLLOW_UP,
			completed: false,
			completion_time: null,
			notes_added: false,
			contactName: reminderData.contactName || '',
		};

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

// Real-time Reminders Subscription
export const subscribeToReminders = (userId, status, callback) => {
	const subscriptionKey = `reminders_${userId}_${status}`;
	if (activeSubscriptions.has(subscriptionKey)) {
		activeSubscriptions.get(subscriptionKey)();
	}

	const remindersRef = collection(db, 'reminders');
	const q = query(remindersRef, where('user_id', '==', userId), where('status', '==', status));

	const unsubscribe = onSnapshot(
		q,
		(snapshot) => {
			const reminders = snapshot.docs.map((doc) => {
				const data = doc.data();
				let scheduledTime;
				try {
					if (data.scheduledTime?.toDate) {
						scheduledTime = data.scheduledTime.toDate();
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
					contact_id: data.contact_id || data.contactId,
					call_data: data.call_data || null,
					type: data.type || 'regular',
				};
			});

			cacheManager.saveReminders(userId, reminders);
			callback(reminders);
		},
		(error) => {
			console.error('Error in reminders subscription:', error);
			cacheManager.getCachedReminders(userId).then((cached) => {
				if (cached) callback(cached);
			});
		}
	);

	activeSubscriptions.set(subscriptionKey, unsubscribe);
	return unsubscribe;
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
			where('user_id', '==', userId),
			where('status', '==', status),
			orderBy('scheduledTime', 'desc')
		);

		const snapshot = await getDocs(q);

		return snapshot.docs.map((doc) => {
			const data = doc.data();
			let scheduledTime;
			try {
				if (data.scheduledTime?.toDate) {
					scheduledTime = data.scheduledTime.toDate();
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
				contact_id: data.contact_id || data.contactId,
				call_data: data.call_data || null,
				type: data.type || 'regular',
			};
		});
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
		return querySnapshot.docs.map((doc) => ({
			id: doc.id,
			...doc.data(),
		}));
	} catch (error) {
		console.error('Error getting contact reminders:', error);
		throw error;
	}
};

// Follow-up Operations
export const getFollowUpReminders = async (userId) => {
	try {
		const remindersRef = collection(db, 'reminders');
		const q = query(
			remindersRef,
			where('user_id', '==', userId),
			where('type', '==', 'FOLLOW_UP'),
			where('completed', '==', false),
			orderBy('scheduledTime', 'desc')
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
			console.error('[Firestore] Reminder not found:', reminderId);
			throw new Error('Reminder not found');
		}

		const reminderData = reminderDoc.data();

		if (reminderData.user_id !== auth.currentUser?.uid) {
			console.error('[Firestore] Permission denied for user:', auth.currentUser?.uid);
			throw new Error('User does not have permission to modify this reminder');
		}

		const batch = writeBatch(db);

		// Delete the reminder when dismiss is selected
		batch.delete(reminderRef);

		// If there are notes, add them to contact history
		if (notes && reminderData.contact_id) {
			const contactRef = doc(db, 'contacts', reminderData.contact_id);
			const contactDoc = await getDoc(contactRef);

			if (contactDoc.exists()) {
				const contactData = contactDoc.data();
				const history = contactData.contact_history || [];

				const newHistoryEntry = {
					date: new Date().toISOString(),
					notes: notes,
					type: 'FOLLOW_UP',
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
		console.error('[Firestore] Error completing follow-up:', error);
		throw error;
	}
};

// User Profile Operations
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

export const checkUsernameExists = async (username, currentUserId) => {
	try {
		const usersRef = collection(db, 'users');
		const q = query(usersRef, where('username', '==', username.toLowerCase()));
		const querySnapshot = await getDocs(q);
		return querySnapshot.docs.some((doc) => doc.id !== currentUserId);
	} catch (error) {
		console.error('Error checking username:', error);
		throw error;
	}
};

// Real-time User Profile Subscription
export const subscribeToUserProfile = (userId, callback) => {
	if (activeSubscriptions.has(`profile_${userId}`)) {
		activeSubscriptions.get(`profile_${userId}`)();
	}

	const userRef = doc(db, 'users', userId);
	const unsubscribe = onSnapshot(
		userRef,
		async (doc) => {
			if (!doc.exists()) {
				const defaultProfile = {
					created_at: serverTimestamp(),
					notifications_enabled: true,
					email: userId,
					photo_url: null,
					first_name: '',
					last_name: '',
				};
				await setDoc(userRef, defaultProfile);
				callback(defaultProfile);
			} else {
				callback(doc.data());
			}
		},
		(error) => {
			console.error('Error in user profile subscription:', error);
		}
	);

	activeSubscriptions.set(`profile_${userId}`, unsubscribe);
	return unsubscribe;
};

export const getUserProfile = async (userId) => {
	try {
		const userDocRef = doc(db, 'users', userId);
		// Fetch the latest data from the server, bypassing the cache
		const userDoc = await getDoc(userDocRef);
		if (userDoc.exists()) {
			return userDoc.data();
		} else {
			console.error('User document not found in Firestore.');
			return null;
		}
	} catch (error) {
		console.error('Error fetching user profile:', error);
		throw error;
	}
};

export const uploadProfilePhoto = async (userId, photoUri) => {
	try {
		const response = await fetch(photoUri);
		const blob = await response.blob();
		const filename = `profiles/${userId}/${Date.now()}.jpg`;
		const storageRef = ref(storage, filename);

		await uploadBytes(storageRef, blob);
		const photoURL = await getDownloadURL(storageRef);

		// Update user profile with new photo URL
		const userRef = doc(db, 'users', userId);
		await updateDoc(userRef, {
			photo_url: photoURL,
			last_updated: serverTimestamp(),
		});

		// Update cache with new photo URL
		const cachedProfile = await cacheManager.getCachedProfile(userId);
		if (cachedProfile) {
			await cacheManager.saveProfile(userId, {
				...cachedProfile,
				photo_url: photoURL,
				last_updated: new Date().toISOString(),
			});
		}

		return photoURL;
	} catch (error) {
		console.error('Error uploading profile photo:', error);
		return null;
	}
};

// Data Export and Account Deletion
export const exportUserData = async (userId) => {
	try {
		const userProfile = await getUserProfile(userId);
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

export const deleteUserAccount = async (userId) => {
	try {
		const contactsRef = collection(db, 'contacts');
		const q = query(contactsRef, where('user_id', '==', userId));
		const querySnapshot = await getDocs(q);

		const batch = writeBatch(db);
		querySnapshot.forEach((doc) => {
			batch.delete(doc.ref);
		});

		const userRef = doc(db, 'users', userId);
		batch.delete(userRef);

		await batch.commit();
		cleanupSubscriptions();
	} catch (error) {
		console.error('Error deleting user account:', error);
		throw error;
	}
};

// Export all functions
export default {
	// Subscription management
	subscribeToContacts,
	subscribeToContactDetails,
	subscribeToUpcomingContacts,
	subscribeToReminders,
	subscribeToUserProfile,
	cleanupSubscriptions,

	// Contact operations
	addContact,
	updateContact,
	deleteContact,
	archiveContact,
	fetchContacts,
	addContactHistory,
	fetchContactHistory,

	// Reminder operations
	addReminder,
	updateReminder,
	deleteReminder,
	getReminder,
	getReminders,
	getContactReminders,
	completeFollowUp,

	// User profile operations
	createUserDocument,
	getUserProfile,
	updateUserProfile,
	uploadProfilePhoto,
	uploadContactPhoto,
	checkUsernameExists,

	// Data management
	exportUserData,
	deleteUserAccount,
};
