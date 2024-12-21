import React, { useState, useEffect } from 'react';
import {
	Text,
	View,
	ScrollView,
	TouchableOpacity,
	RefreshControl,
	Alert,
	Modal,
	Platform,
} from 'react-native';
import styles from '../styles/screens/dashboard';
import commonStyles from '../styles/common';
import { colors } from '../styles/theme';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import {
	fetchUpcomingContacts,
	fetchPastContacts,
	addContactHistory,
	updateContact,
} from '../utils/firestore';
import { Image as ExpoImage } from 'expo-image';

const StatsView = ({ stats }) => (
	<ScrollView style={styles.statsContainer}>
		<View style={commonStyles.card}>
			<Text style={styles.statTitle}>This Month</Text>
			<Text style={styles.statValue}>{stats.monthlyContacts}</Text>
			<Text style={styles.statLabel}>Contacts Made</Text>
		</View>

		<View style={commonStyles.card}>
			<Text style={styles.statTitle}>Current Streak</Text>
			<Text style={styles.statValue}>{stats.currentStreak}</Text>
			<Text style={styles.statLabel}>Days</Text>
		</View>

		<View style={commonStyles.card}>
			<Text style={styles.statTitle}>Most Frequent Contacts</Text>
			{stats.frequentContacts.map((contact, index) => (
				<Text key={index} style={styles.statListItem}>
					{contact.name} ({contact.count} times)
				</Text>
			))}
		</View>

		<View style={commonStyles.card}>
			<Text style={styles.statTitle}>Needs Attention</Text>
			{stats.needsAttention.length > 0 ? (
				stats.needsAttention.map((contact, index) => (
					<Text key={index} style={styles.statListItem}>
						{contact.name} (Last:{' '}
						{contact.lastContact === 'Never' ? 'Never' : new Date(contact.lastContact).toLocaleDateString()})
					</Text>
				))
			) : (
				<Text style={styles.congratsMessage}>
					Congratulations! You don't have any contacts that haven't been contacted in the last 30 days.
				</Text>
			)}
		</View>

		<View style={commonStyles.card}>
			<Text style={styles.statTitle}>Total Active Relationships</Text>
			<Text style={styles.statValue}>{stats.totalActive}</Text>
			<Text style={styles.statLabel}>Contacts</Text>
		</View>
	</ScrollView>
);

// Contact Card Component
const ContactCard = ({ contact, onPress }) => (
	<TouchableOpacity style={commonStyles.card} onPress={() => onPress(contact)}>
		<View style={styles.cardHeader}>
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
			<View style={styles.cardInfo}>
				<Text style={styles.cardName}>{`${contact.first_name} ${contact.last_name || ''}`}</Text>
				<Text style={styles.cardDate}>
					Next Contact: {new Date(contact.next_contact).toLocaleDateString()}
				</Text>
			</View>
			<Icon name="time-outline" size={16} color={colors.text.secondary} />
		</View>
	</TouchableOpacity>
);

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
