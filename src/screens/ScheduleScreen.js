import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
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

// Memoized ContactCard component to prevent re-renders when props don't change
const ContactCard = React.memo(
	({ contact, navigation, styles, colors, getCallTypeLabel, getFormattedDate }) => {
		const handlePress = useCallback(() => {
			const cleanContact = { ...contact };
			navigation.navigate('ContactDetails', {
				contact: cleanContact,
				initialTab: 'Schedule',
			});
		}, [contact, navigation]);

		return (
			<TouchableOpacity style={styles.contactCard} onPress={handlePress}>
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
						<Text style={styles.reminderType}>{getCallTypeLabel(contact)}</Text>
					</View>
				</View>
				<View style={styles.contactCardFooter}>
					<View style={styles.dateContainer}>
						<Icon name="calendar-clear-outline" size={16} color={colors.primary} style={styles.dateIcon} />
						<Text style={styles.contactDate}>{getFormattedDate(contact.next_contact)}</Text>
					</View>
				</View>
			</TouchableOpacity>
		);
	}
);

// Memoized ContactGroup component
const ContactGroup = React.memo(
	({ title, contacts, navigation, styles, colors, getCallTypeLabel, getFormattedDate }) => {
		if (contacts.length === 0) return null;

		return (
			<View style={styles.contactGroup}>
				<View style={styles.groupHeader}>
					<Text style={styles.groupTitle}>{title}</Text>
				</View>
				<View style={styles.contactList}>
					{contacts.map((contact) => (
						<ContactCard
							key={contact.id}
							contact={contact}
							navigation={navigation}
							styles={styles}
							colors={colors}
							getCallTypeLabel={getCallTypeLabel}
							getFormattedDate={getFormattedDate}
						/>
					))}
				</View>
			</View>
		);
	}
);

export default function ScheduleScreen({ navigation }) {
	const { user } = useAuth();
	const { colors } = useTheme();
	const styles = useStyles();
	const commonStyles = useCommonStyles();
	const [contacts, setContacts] = useState([]);
	const [refreshing, setRefreshing] = useState(false);
	const [loading, setLoading] = useState(true);
	const [lastUpdateTime, setLastUpdateTime] = useState(0);

	// Load contacts initially
	useEffect(() => {
		if (user) {
			loadContacts();
		}
	}, [user]);

	// Optimized screen focus effect
	useEffect(() => {
		const unsubscribe = navigation.addListener('focus', () => {
			// Only refresh if it's been at least 2 seconds since the last update
			// This prevents rapid refreshes when navigating quickly
			const now = Date.now();
			if (now - lastUpdateTime > 2000) {
				checkForUpdates();
				setLastUpdateTime(now);
			}
		});

		return unsubscribe;
	}, [navigation, lastUpdateTime]);

	// Check if we need to update contacts, but avoid full re-renders if possible
	const checkForUpdates = async () => {
		try {
			if (!user) return;

			const freshContacts = await fetchUpcomingContacts(user.uid);
			if (freshContacts && contactsNeedUpdate(contacts, freshContacts)) {
				const sortedContacts = sortContactsByDate(freshContacts);
				setContacts(sortedContacts);
				await cacheManager.saveUpcomingContacts(user.uid, freshContacts);
			}
		} catch (error) {
			console.error('Error checking for contact updates:', error);
		}
	};

	// Determine if contacts have changed in a meaningful way
	const contactsNeedUpdate = (oldContacts, newContacts) => {
		if (oldContacts.length !== newContacts.length) return true;

		// Create maps for faster lookups
		const oldMap = new Map(oldContacts.map((c) => [c.id, c]));

		// Check if any contacts are new or have updated scheduling
		for (const newContact of newContacts) {
			const oldContact = oldMap.get(newContact.id);

			// Contact is new
			if (!oldContact) return true;

			// Check if scheduling info changed
			if (oldContact.next_contact !== newContact.next_contact) return true;
			if (oldContact?.scheduling?.frequency !== newContact?.scheduling?.frequency) return true;
			if (oldContact?.scheduling?.custom_next_date !== newContact?.scheduling?.custom_next_date) return true;
		}

		return false;
	};

	// Sort contacts by date
	const sortContactsByDate = useCallback((contactsToSort) => {
		return [...contactsToSort].sort((a, b) => {
			const dateA = a.next_contact ? new Date(a.next_contact) : new Date(0);
			const dateB = b.next_contact ? new Date(b.next_contact) : new Date(0);
			return dateA - dateB;
		});
	}, []);

	// Full data load
	async function loadContacts() {
		try {
			if (!user) return;

			// Load cached contacts first for immediate display
			const cachedContacts = await cacheManager.getCachedUpcomingContacts(user.uid);
			if (cachedContacts) {
				setContacts(sortContactsByDate(cachedContacts));
			}

			// Then fetch fresh data
			const freshContacts = await fetchUpcomingContacts(user.uid);
			if (freshContacts) {
				setContacts(sortContactsByDate(freshContacts));
				await cacheManager.saveUpcomingContacts(user.uid, freshContacts);
				setLastUpdateTime(Date.now());
			}
		} catch (error) {
			console.error('Error loading contacts:', error);
			Alert.alert('Error', 'Failed to load contacts');
		} finally {
			setLoading(false);
		}
	}

	const onRefresh = useCallback(async () => {
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
	const formatDate = useCallback((dateStr) => {
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
	}, []);

	const parseDate = useCallback((dateValue) => {
		try {
			if (dateValue instanceof Object && dateValue.seconds) {
				return new Date(dateValue.seconds * 1000);
			} else if (dateValue?.toDate) {
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
	}, []);

	// Get formatted date for display
	const getFormattedDate = useCallback(
		(dateValue) => {
			try {
				const date = parseDate(dateValue);
				return formatDate(date);
			} catch (error) {
				return 'Unknown date';
			}
		},
		[formatDate, parseDate]
	);

	// Get contact call type label
	const getCallTypeLabel = useCallback((contact) => {
		// For custom dates
		if (contact?.scheduling?.custom_next_date) {
			return 'Custom Date';
		}

		// For recurring frequencies
		if (contact?.scheduling?.frequency) {
			const frequencyLabel = FREQUENCY_DISPLAY_MAP[contact.scheduling.frequency] || 'Scheduled';
			return `${frequencyLabel} Schedule`;
		}

		return 'Check-in';
	}, []);

	// Group contacts by time period - memoized to prevent recalculation on every render
	const contactGroups = useMemo(() => {
		const groups = {
			today: { title: 'Today', contacts: [] },
			tomorrow: { title: 'Tomorrow', contacts: [] },
			thisWeek: { title: 'This Week', contacts: [] },
			thisMonth: { title: 'Upcoming Month', contacts: [] },
			future: { title: 'Future', contacts: [] },
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
		contacts
			.filter((contact) => contact.next_contact)
			.forEach((contact) => {
				try {
					let contactDate = parseDate(contact.next_contact);

					// Add to appropriate group
					if (contactDate.toDateString() === today.toDateString()) {
						groups.today.contacts.push({ ...contact });
					} else if (contactDate.toDateString() === tomorrow.toDateString()) {
						groups.tomorrow.contacts.push({ ...contact });
					} else if (contactDate < nextWeek) {
						groups.thisWeek.contacts.push({ ...contact });
					} else if (contactDate < nextMonth) {
						groups.thisMonth.contacts.push({ ...contact });
					} else {
						groups.future.contacts.push({ ...contact });
					}
				} catch (error) {
					console.warn('Error grouping contact:', contact.id, error);
				}
			});

		// Sort each group by date
		Object.values(groups).forEach((group) => {
			group.contacts.sort((a, b) => {
				const dateA = parseDate(a.next_contact);
				const dateB = parseDate(b.next_contact);
				return dateA - dateB;
			});
		});

		return groups;
	}, [contacts, parseDate]);

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

	if (!user) {
		return (
			<View style={commonStyles.container}>
				<Text style={commonStyles.message}>Please log in to view your schedule</Text>
			</View>
		);
	}

	const hasContacts = Object.values(contactGroups).some((group) => group.contacts.length > 0);

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

					{loading && contacts.length === 0 ? (
						<View style={styles.loadingContainer}>
							<Text style={styles.loadingText}>Loading your schedule...</Text>
						</View>
					) : !hasContacts ? (
						<EmptyState />
					) : (
						<View style={styles.groupsContainer}>
							<ContactGroup
								title="Today"
								contacts={contactGroups.today.contacts}
								navigation={navigation}
								styles={styles}
								colors={colors}
								getCallTypeLabel={getCallTypeLabel}
								getFormattedDate={getFormattedDate}
							/>
							<ContactGroup
								title="Tomorrow"
								contacts={contactGroups.tomorrow.contacts}
								navigation={navigation}
								styles={styles}
								colors={colors}
								getCallTypeLabel={getCallTypeLabel}
								getFormattedDate={getFormattedDate}
							/>
							<ContactGroup
								title="This Week"
								contacts={contactGroups.thisWeek.contacts}
								navigation={navigation}
								styles={styles}
								colors={colors}
								getCallTypeLabel={getCallTypeLabel}
								getFormattedDate={getFormattedDate}
							/>
							<ContactGroup
								title="Upcoming Month"
								contacts={contactGroups.thisMonth.contacts}
								navigation={navigation}
								styles={styles}
								colors={colors}
								getCallTypeLabel={getCallTypeLabel}
								getFormattedDate={getFormattedDate}
							/>
							<ContactGroup
								title="Future"
								contacts={contactGroups.future.contacts}
								navigation={navigation}
								styles={styles}
								colors={colors}
								getCallTypeLabel={getCallTypeLabel}
								getFormattedDate={getFormattedDate}
							/>
						</View>
					)}
				</View>
			</ScrollView>
		</View>
	);
}
