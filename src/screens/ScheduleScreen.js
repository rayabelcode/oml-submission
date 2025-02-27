import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { useStyles } from '../styles/screens/schedule';
import { useCommonStyles } from '../styles/common';
import { useTheme } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { Image as ExpoImage } from 'expo-image';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { fetchUpcomingContacts } from '../utils/firestore';
import { cacheManager } from '../utils/cache';
import { FREQUENCY_DISPLAY_MAP } from '../../constants/notificationConstants';

export default function ScheduleScreen({ navigation }) {
	const { user } = useAuth();
	const { colors, spacing } = useTheme();
	const styles = useStyles();
	const commonStyles = useCommonStyles();
	const [contacts, setContacts] = useState([]);
	const [refreshing, setRefreshing] = useState(false);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (user) {
			loadContacts();
		}
	}, [user]);

	async function loadContacts() {
		try {
			if (!user) return;

			// Load cached contacts first for immediate display
			const cachedContacts = await cacheManager.getCachedUpcomingContacts(user.uid);
			if (cachedContacts) {
				setContacts(
					cachedContacts.sort((a, b) => {
						const dateA = a.next_contact ? new Date(a.next_contact) : new Date(0);
						const dateB = b.next_contact ? new Date(b.next_contact) : new Date(0);
						return dateA - dateB;
					})
				);
			}

			// Then fetch fresh data from the server
			const freshContacts = await fetchUpcomingContacts(user.uid);
			if (freshContacts) {
				setContacts(
					freshContacts.sort((a, b) => {
						const dateA = a.next_contact ? new Date(a.next_contact) : new Date(0);
						const dateB = b.next_contact ? new Date(b.next_contact) : new Date(0);
						return dateA - dateB;
					})
				);
				await cacheManager.saveUpcomingContacts(user.uid, freshContacts);
			}
		} catch (error) {
			console.error('Error loading contacts:', error);
			Alert.alert('Error', 'Failed to load contacts');
		} finally {
			setLoading(false);
		}
	}

	const onRefresh = React.useCallback(async () => {
		setRefreshing(true);
		try {
			await loadContacts();
		} catch (error) {
			console.error('Error refreshing data:', error);
			Alert.alert('Error', 'Failed to refresh data');
		} finally {
			setRefreshing(false);
		}
	}, []);

	// Format date in a human-readable way
	const formatDate = (dateStr) => {
		try {
			const date = new Date(dateStr);
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			
			const tomorrow = new Date(today);
			tomorrow.setDate(tomorrow.getDate() + 1);
			
			const nextWeek = new Date(today);
			nextWeek.setDate(nextWeek.getDate() + 7);
			
			if (date.toDateString() === today.toDateString()) {
				return 'Today';
			} else if (date.toDateString() === tomorrow.toDateString()) {
				return 'Tomorrow';
			} else if (date < nextWeek) {
				return date.toLocaleDateString('en-US', { weekday: 'long' });
			} else {
				return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
			}
		} catch (error) {
			console.warn('Error formatting date:', error);
			return 'Date unknown';
		}
	};

	// Group contacts by time period
	const groupContacts = () => {
		const groups = {
			today: { title: 'Today', contacts: [] },
			tomorrow: { title: 'Tomorrow', contacts: [] },
			thisWeek: { title: 'This Week', contacts: [] },
			thisMonth: { title: 'This Month', contacts: [] },
			future: { title: 'Future', contacts: [] }
		};
		
		// Get date boundaries
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);
		
		const nextWeek = new Date(today);
		nextWeek.setDate(nextWeek.getDate() + 7);
		
		const nextMonth = new Date(today);
		nextMonth.setMonth(nextMonth.getMonth() + 1);
		
		// Filter contacts with next_contact and group them
		contacts.filter(contact => contact.next_contact).forEach(contact => {
			try {
				let contactDate;
				
				if (contact.next_contact instanceof Object && contact.next_contact.seconds) {
					contactDate = new Date(contact.next_contact.seconds * 1000);
				} else if (contact.next_contact.toDate) {
					contactDate = contact.next_contact.toDate();
				} else if (typeof contact.next_contact === 'string') {
					contactDate = new Date(contact.next_contact);
				} else if (contact.next_contact instanceof Date) {
					contactDate = contact.next_contact;
				} else {
					return; // Skip if date can't be parsed
				}
				
				// Add to appropriate group without adding the parsed date to prevent navigation warning
				if (contactDate.toDateString() === today.toDateString()) {
					groups.today.contacts.push({...contact});
				} else if (contactDate.toDateString() === tomorrow.toDateString()) {
					groups.tomorrow.contacts.push({...contact});
				} else if (contactDate < nextWeek) {
					groups.thisWeek.contacts.push({...contact});
				} else if (contactDate < nextMonth) {
					groups.thisMonth.contacts.push({...contact});
				} else {
					groups.future.contacts.push({...contact});
				}
			} catch (error) {
				console.warn('Error grouping contact:', contact.id, error);
			}
		});
		
		// Sort each group by date
		Object.values(groups).forEach(group => {
			group.contacts.sort((a, b) => {
				const dateA = parseDate(a.next_contact);
				const dateB = parseDate(b.next_contact);
				return dateA - dateB;
			});
		});
		
		return groups;
	};

	const parseDate = (dateValue) => {
		try {
			if (dateValue instanceof Object && dateValue.seconds) {
				return new Date(dateValue.seconds * 1000);
			} else if (dateValue.toDate) {
				return dateValue.toDate();
			} else if (typeof dateValue === 'string') {
				return new Date(dateValue);
			} else if (dateValue instanceof Date) {
				return dateValue;
			}
			return new Date(0);
		} catch (error) {
			return new Date(0);
		}
	};

	// Get formatted date for display
	const getFormattedDate = (dateValue) => {
		try {
			const date = parseDate(dateValue);
			return formatDate(date);
		} catch (error) {
			return "Unknown date";
		}
	};

	// Get contact frequency label
	const getFrequencyLabel = (contact) => {
		if (!contact?.scheduling?.frequency) return '';
		return FREQUENCY_DISPLAY_MAP[contact.scheduling.frequency] || '';
	};

	// Empty state component
	const EmptyState = () => (
		<View style={styles.emptyStateContainer}>
			<Icon name="calendar-outline" size={60} color={colors.text.secondary} style={styles.emptyStateIcon} />
			<Text style={styles.emptyStateTitle}>No upcoming calls</Text>
			<Text style={styles.emptyStateMessage}>
				When you schedule calls with your contacts, they'll appear here.
			</Text>
			<TouchableOpacity 
				style={[commonStyles.primaryButton, styles.emptyStateButton]} 
				onPress={() => navigation.navigate('Contacts')}
			>
				<Text style={commonStyles.primaryButtonText}>Go to Contacts</Text>
			</TouchableOpacity>
		</View>
	);

	// Contact card component
	const ContactCard = ({ contact }) => {
		return (
			<TouchableOpacity
				style={styles.contactCard}
				onPress={() => navigation.navigate('ContactDetails', { contact, initialTab: 'Schedule' })}
			>
				<View style={styles.contactCardHeader}>
					<View style={styles.avatarContainer}>
						{contact.photo_url ? (
							<ExpoImage
								source={{ uri: contact.photo_url }}
								style={styles.avatar}
								cachePolicy="memory-disk"
								transition={200}
							/>
						) : (
							<View style={styles.defaultAvatar}>
								<Icon name="person" size={32} color={colors.background.secondary} />
							</View>
						)}
					</View>
					<View style={styles.contactInfo}>
						<Text style={styles.contactName} numberOfLines={1}>
							{contact.first_name} {contact.last_name}
						</Text>
						<Text style={styles.reminderType}>{getFrequencyLabel(contact)}</Text>
					</View>
				</View>
				<View style={styles.contactCardFooter}>
					<View style={styles.dateContainer}>
						<Icon name="calendar-outline" size={16} color={colors.primary} style={styles.dateIcon} />
						<Text style={styles.contactDate}>{getFormattedDate(contact.next_contact)}</Text>
					</View>
				</View>
			</TouchableOpacity>
		);
	};

	// Contact group component
	const ContactGroup = ({ title, contacts }) => {
		if (contacts.length === 0) return null;
		
		return (
			<View style={styles.contactGroup}>
				<View style={styles.groupHeader}>
					<Text style={styles.groupTitle}>{title}</Text>
				</View>
				<View style={styles.contactList}>
					{contacts.map(contact => (
						<ContactCard key={contact.id} contact={contact} />
					))}
				</View>
			</View>
		);
	};

	if (!user) {
		return (
			<View style={commonStyles.container}>
				<Text style={commonStyles.message}>Please log in to view your schedule</Text>
			</View>
		);
	}

	const contactGroups = groupContacts();
	const hasContacts = Object.values(contactGroups).some(group => group.contacts.length > 0);

	return (
		<View style={commonStyles.container}>
			<StatusBar style="auto" />
			<ScrollView
				style={{ flex: 1 }}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
				contentContainerStyle={!hasContacts && !loading ? { flexGrow: 1 } : {}}
			>
				<View style={styles.section}>
					<View style={commonStyles.pageHeader}>
						<Icon name="calendar-clear-outline" size={22} style={commonStyles.pageHeaderIcon} />
						<Text style={commonStyles.pageHeaderTitle}>Upcoming Calls</Text>
					</View>
					
					{loading ? (
						<View style={styles.loadingContainer}>
							<ActivityIndicator size="large" color={colors.primary} />
							<Text style={styles.loadingText}>Loading your schedule...</Text>
						</View>
					) : !hasContacts ? (
						<EmptyState />
					) : (
						<View style={styles.groupsContainer}>
							<ContactGroup title="Today" contacts={contactGroups.today.contacts} />
							<ContactGroup title="Tomorrow" contacts={contactGroups.tomorrow.contacts} />
							<ContactGroup title="This Week" contacts={contactGroups.thisWeek.contacts} />
							<ContactGroup title="This Month" contacts={contactGroups.thisMonth.contacts} />
							<ContactGroup title="Future" contacts={contactGroups.future.contacts} />
						</View>
					)}
				</View>
			</ScrollView>
		</View>
	);
}
