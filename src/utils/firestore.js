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
  serverTimestamp,
  limit
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Contacts operations
export const fetchContacts = async (userId, searchQuery = '') => {
  try {
    const contactsRef = collection(db, 'contacts');
    const q = query(
      contactsRef,
      where('user_id', '==', userId),
      orderBy('name')
    );
    
    const querySnapshot = await getDocs(q);
    const contacts = [];
    
    querySnapshot.forEach((doc) => {
      contacts.push({ id: doc.id, ...doc.data() });
    });

    if (searchQuery) {
      return contacts.filter(contact => 
        contact.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return contacts;
  } catch (error) {
    console.error('Error fetching contacts:', error);
    throw error;
  }
};

export const addContact = async (userId, contactData) => {
  try {
    const contactsRef = collection(db, 'contacts');
    const newContact = {
      ...contactData,
      user_id: userId,
      created_at: serverTimestamp(),
      last_contact: null,
      last_updated: serverTimestamp()
    };
    
    const docRef = await addDoc(contactsRef, newContact);
    return { id: docRef.id, ...newContact };
  } catch (error) {
    console.error('Error adding contact:', error);
    throw error;
  }
};

export const updateContact = async (contactId, updateData) => {
  try {
    const contactRef = doc(db, 'contacts', contactId);
    const updates = {
      ...updateData,
      last_updated: serverTimestamp()
    };
    
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

// Reminders operations
export const fetchReminders = async (userId) => {
  try {
    const remindersRef = collection(db, 'reminders');
    const q = query(
      remindersRef,
      where('user_id', '==', userId),
      where('completed', '==', false),
      orderBy('due_date'),
      limit(20)
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

export const addReminder = async (userId, reminderData) => {
  try {
    const remindersRef = collection(db, 'reminders');
    const newReminder = {
      ...reminderData,
      user_id: userId,
      completed: false,
      created_at: serverTimestamp(),
      last_updated: serverTimestamp()
    };
    
    const docRef = await addDoc(remindersRef, newReminder);
    return { id: docRef.id, ...newReminder };
  } catch (error) {
    console.error('Error adding reminder:', error);
    throw error;
  }
};

export const updateReminder = async (reminderId, updateData) => {
  try {
    const reminderRef = doc(db, 'reminders', reminderId);
    const updates = {
      ...updateData,
      last_updated: serverTimestamp()
    };
    
    await updateDoc(reminderRef, updates);
  } catch (error) {
    console.error('Error updating reminder:', error);
    throw error;
  }
};

export const completeReminder = async (reminderId) => {
  try {
    const reminderRef = doc(db, 'reminders', reminderId);
    await updateDoc(reminderRef, {
      completed: true,
      completed_at: serverTimestamp(),
      last_updated: serverTimestamp()
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