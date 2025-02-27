// screens/ScheduleScreen.js
import React, { useState, useEffect } from 'react';
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

export default function ScheduleScreen({ navigation }) {
	const { user } = useAuth();
	const { colors } = useTheme();
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

			// First try loading from cache
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

			// Then fetch fresh data
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

	if (!user) {
		return (
			<View style={commonStyles.container}>
				<Text style={commonStyles.message}>Please log in to view your schedule</Text>
			</View>
		);
	}

	return (
		<View style={commonStyles.container}>
			<StatusBar style="auto" />
			<ScrollView
				style={{ flex: 1 }}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
			>
				<View style={styles.section}>
					<View style={styles.groupHeader}>
						<Text style={styles.groupTitle}>Upcoming Calls</Text>
					</View>
					{loading ? (
						<Text style={commonStyles.message}>Loading contacts...</Text>
					) : contacts.length === 0 ? (
						<Text style={commonStyles.message}>No upcoming contacts</Text>
					) : (
						<View style={styles.upcomingGrid}>
							{contacts
								.filter((contact) => contact.next_contact)
								.sort((a, b) => {
									const dateA = new Date(
										a.next_contact?.seconds ? a.next_contact.seconds * 1000 : a.next_contact
									);
									const dateB = new Date(
										b.next_contact?.seconds ? b.next_contact.seconds * 1000 : b.next_contact
									);
									return dateA - dateB;
								})
								.map((contact) => {
									let formattedDate = null;
									try {
										if (contact.next_contact) {
											if (contact.next_contact instanceof Object && contact.next_contact.seconds) {
												formattedDate = new Date(contact.next_contact.seconds * 1000).toISOString();
											} else if (contact.next_contact.toDate) {
												formattedDate = contact.next_contact.toDate().toISOString();
											} else if (typeof contact.next_contact === 'string') {
												formattedDate = contact.next_contact;
											} else if (contact.next_contact instanceof Date) {
												formattedDate = contact.next_contact.toISOString();
											}
										}
									} catch (error) {
										console.warn('Error formatting date for contact:', contact.id, error);
										return null;
									}

									if (!formattedDate) {
										console.warn('Could not format date for contact:', contact.id, contact.next_contact);
										return null;
									}

									return (
										<TouchableOpacity
											key={contact.id}
											style={styles.upcomingContactCard}
											onPress={() =>
												navigation.navigate('ContactDetails', { contact, initialTab: 'Schedule' })
											}
										>
											<Text
												style={styles.upcomingContactName}
												numberOfLines={1}
												adjustsFontSizeToFit={true}
												minimumFontScale={0.8}
											>
												{contact.first_name} {contact.last_name}
											</Text>

											<View style={styles.contactRow}>
												<View style={styles.avatarContainer}>
													{contact.photo_url ? (
														<ExpoImage
															source={{ uri: contact.photo_url }}
															style={styles.avatar}
															cachePolicy="memory-disk"
															transition={200}
														/>
													) : (
														<Icon name="person-outline" size={24} color={colors.primary} />
													)}
												</View>
												<Text style={styles.upcomingContactDate}>
													{new Date(formattedDate)
														.toLocaleDateString('en-US', {
															month: 'numeric',
															day: 'numeric',
															year: 'numeric',
														})
														.replace(/\//g, '/')}
												</Text>
											</View>
										</TouchableOpacity>
									);
								})
								.filter(Boolean)}
						</View>
					)}
				</View>
			</ScrollView>
		</View>
	);
}
