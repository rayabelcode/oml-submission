import React, { useState, useEffect } from 'react';
import { Text, View, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import styles from '../styles/screens/dashboard';
import commonStyles from '../styles/common';
import { colors } from '../styles/theme';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { fetchUpcomingContacts } from '../utils/firestore';
import StatsView from '../components/dashboard/StatsView'; // Import StatsView component
import ContactCard from '../components/dashboard/ContactCard'; // Import ContactCard component

export default function DashboardScreen({ navigation }) {
	const { user } = useAuth();
	const [contacts, setContacts] = useState([]);
	const [refreshing, setRefreshing] = useState(false);
	const [loading, setLoading] = useState(true);
	const [viewMode, setViewMode] = useState('calendar');

	const [stats, setStats] = useState({
		monthlyContacts: 0,
		currentStreak: 0,
		frequentContacts: [],
		needsAttention: [],
		totalActive: 0,
	});

	const calculateStats = async () => {
		try {
			const now = new Date();
			const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

			// Get all contacts
			const allContacts = await fetchUpcomingContacts(user.uid);

			// Monthly contacts (completed this month)
			const monthlyCount = allContacts.reduce((count, contact) => {
				return count + (contact.contact_history?.filter((h) => new Date(h.date) >= monthStart).length || 0);
			}, 0);

			// Calculate streak (consecutive days with at least one contact)
			let streak = 0;
			const today = new Date().setHours(0, 0, 0, 0);
			let checkDate = today;
			let hasContact = true;

			while (hasContact) {
				const dateContacts = allContacts.some((contact) =>
					contact.contact_history?.some((h) => new Date(h.date).setHours(0, 0, 0, 0) === checkDate)
				);

				if (dateContacts) {
					streak++;
					checkDate -= 86400000; // Subtract one day
				} else {
					hasContact = false;
				}
			}

			// Most frequent contacts (last 30 days)
			const thirtyDaysAgo = new Date(now - 30 * 86400000);
			const frequentContacts = allContacts
				.map((contact) => ({
					name: `${contact.first_name} ${contact.last_name}`,
					count: contact.contact_history?.filter((h) => new Date(h.date) >= thirtyDaysAgo).length || 0,
				}))
				.filter((c) => c.count > 0)
				.sort((a, b) => b.count - a.count)
				.slice(0, 5);

			// Contacts needing attention (no contact in last 30 days)
			const needsAttention = allContacts
				.filter((contact) => {
					const lastContact = contact.contact_history?.[0]?.date;
					return !lastContact || new Date(lastContact) < thirtyDaysAgo;
				})
				.map((contact) => ({
					name: `${contact.first_name} ${contact.last_name}`,
					lastContact: contact.contact_history?.[0]?.date || 'Never',
				}))
				.slice(0, 5);

			setStats({
				monthlyContacts: monthlyCount,
				currentStreak: streak,
				frequentContacts,
				needsAttention,
				totalActive: allContacts.length,
			});
		} catch (error) {
			console.error('Error calculating stats:', error);
			Alert.alert('Error', 'Failed to load statistics');
		}
	};

	async function loadContacts() {
		try {
			if (!user) return;
			const contactsList = await fetchUpcomingContacts(user.uid);
			setContacts(contactsList.sort((a, b) => new Date(a.next_contact) - new Date(b.next_contact)));
		} catch (error) {
			console.error('Error loading contacts:', error);
			Alert.alert('Error', 'Failed to load contacts');
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		if (user) {
			loadContacts();
		}
	}, [user]);

	useEffect(() => {
		if (user && viewMode === 'stats') {
			calculateStats();
		}
	}, [user, viewMode]);

	const onRefresh = React.useCallback(async () => {
		setRefreshing(true);
		await loadContacts();
		setRefreshing(false);
	}, []);

	if (!user) {
		return (
			<View style={commonStyles.container}>
				<Text style={commonStyles.message}>Please log in to view your calendar</Text>
			</View>
		);
	}

	return (
		<View style={commonStyles.container}>
			<StatusBar style="auto" />

			<View style={styles.header}>
				<Text style={styles.title}>Calendar + Stats</Text>
			</View>

			<View style={styles.buttonContainer}>
				<TouchableOpacity
					style={[commonStyles.toggleButton, viewMode === 'calendar' && styles.toggleButtonActive]}
					onPress={() => setViewMode('calendar')}
				>
					<Icon name="calendar-clear-outline" size={24} color={colors.primary} />
					<Text style={styles.toggleButtonText}>Upcoming</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={[commonStyles.toggleButton, viewMode === 'stats' && styles.toggleButtonActive]}
					onPress={() => setViewMode('stats')}
				>
					<Icon name="stats-chart-outline" size={24} color={colors.primary} />
					<Text style={styles.toggleButtonText}>Stats</Text>
				</TouchableOpacity>
			</View>

			{viewMode === 'calendar' ? (
				<ScrollView
					style={styles.contactsList}
					refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
				>
					{loading ? (
						<Text style={commonStyles.message}>Loading contacts...</Text>
					) : contacts.length === 0 ? (
						<Text style={commonStyles.message}>No upcoming contacts</Text>
					) : (
						contacts.map((contact) => <ContactCard key={contact.id} contact={contact} onPress={() => {}} />)
					)}
				</ScrollView>
			) : (
				<StatsView stats={stats} />
			)}
		</View>
	);
}
