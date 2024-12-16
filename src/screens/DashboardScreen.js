import React, { useState, useEffect } from 'react';
import {
	StyleSheet,
	Text,
	View,
	ScrollView,
	TouchableOpacity,
	RefreshControl,
	Alert,
	Modal,
	Platform,
} from 'react-native';
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
		<View style={styles.statCard}>
			<Text style={styles.statTitle}>This Month</Text>
			<Text style={styles.statValue}>{stats.monthlyContacts}</Text>
			<Text style={styles.statLabel}>Contacts Made</Text>
		</View>

		<View style={styles.statCard}>
			<Text style={styles.statTitle}>Current Streak</Text>
			<Text style={styles.statValue}>{stats.currentStreak}</Text>
			<Text style={styles.statLabel}>Days</Text>
		</View>

		<View style={styles.statCard}>
			<Text style={styles.statTitle}>Most Frequent Contacts</Text>
			{stats.frequentContacts.map((contact, index) => (
				<Text key={index} style={styles.statListItem}>
					{contact.name} ({contact.count} times)
				</Text>
			))}
		</View>

		<View style={styles.statCard}>
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

		<View style={styles.statCard}>
			<Text style={styles.statTitle}>Total Active Relationships</Text>
			<Text style={styles.statValue}>{stats.totalActive}</Text>
			<Text style={styles.statLabel}>Contacts</Text>
		</View>
	</ScrollView>
);

// Contact Card Component
const ContactCard = ({ contact, onPress }) => (
	<TouchableOpacity style={styles.card} onPress={() => onPress(contact)}>
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
					<Icon name="person-outline" size={24} color="#007AFF" />
				)}
			</View>
			<View style={styles.cardInfo}>
				<Text style={styles.cardName}>{`${contact.first_name} ${contact.last_name || ''}`}</Text>
				<Text style={styles.cardDate}>
					Next Contact: {new Date(contact.next_contact).toLocaleDateString()}
				</Text>
			</View>
			<Icon name="time-outline" size={16} color="#666" />
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
			<View style={styles.container}>
				<Text style={styles.message}>Please log in to view your calendar</Text>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<StatusBar style="auto" />

			<View style={styles.header}>
				<Text style={styles.title}>Calendar + Stats</Text>
			</View>

			<View style={styles.buttonContainer}>
				<TouchableOpacity
					style={[styles.toggleButton, viewMode === 'calendar' && styles.toggleButtonActive]}
					onPress={() => setViewMode('calendar')}
				>
					<Icon name="calendar-clear-outline" size={24} color="#007AFF" />
					<Text style={styles.toggleButtonText}>Upcoming</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={[styles.toggleButton, viewMode === 'stats' && styles.toggleButtonActive]}
					onPress={() => setViewMode('stats')}
				>
					<Icon name="stats-chart-outline" size={24} color="#007AFF" />
					<Text style={styles.toggleButtonText}>Stats</Text>
				</TouchableOpacity>
			</View>

			{viewMode === 'calendar' ? (
				<ScrollView
					style={styles.contactsList}
					refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
				>
					{loading ? (
						<Text style={styles.message}>Loading contacts...</Text>
					) : contacts.length === 0 ? (
						<Text style={styles.message}>No upcoming contacts</Text>
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

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#fff',
		paddingTop: Platform.OS === 'ios' ? 50 : 0,
	},
	header: {
		padding: 20,
		alignItems: 'center',
	},
	title: {
		fontSize: 24,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	buttonContainer: {
		flexDirection: 'row',
		paddingHorizontal: 15,
		paddingBottom: 15,
		borderBottomWidth: 1,
		borderBottomColor: '#eee',
	},
	toggleButton: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 12,
		backgroundColor: '#f8f9fa',
		margin: 5,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: '#007AFF',
	},
	toggleButtonText: {
		marginLeft: 8,
		fontSize: 16,
		color: '#007AFF',
		fontWeight: '500',
	},
	contactsList: {
		flex: 1,
		padding: 15,
	},
	message: {
		textAlign: 'center',
		padding: 20,
		color: '#666',
		fontSize: 16,
	},
	card: {
		backgroundColor: '#f8f9fa',
		padding: 15,
		borderRadius: 10,
		marginBottom: 10,
		borderWidth: 1,
		borderColor: '#eee',
	},
	cardHeader: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	avatarContainer: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: '#e8f2ff',
		justifyContent: 'center',
		alignItems: 'center',
		marginRight: 12,
	},
	avatar: {
		width: 40,
		height: 40,
		borderRadius: 20,
	},
	cardInfo: {
		flex: 1,
	},
	cardName: {
		fontSize: 16,
		fontWeight: '500',
		marginBottom: 4,
	},
	cardDate: {
		fontSize: 14,
		color: '#666',
	},
	cardDate: {
		fontSize: 14,
		color: '#666',
	},
	statsContainer: {
		flex: 1,
		padding: 15,
	},
	statCard: {
		backgroundColor: '#f8f9fa',
		padding: 20,
		borderRadius: 10,
		marginBottom: 15,
		borderWidth: 1,
		borderColor: '#eee',
	},
	statTitle: {
		fontSize: 16,
		fontWeight: '600',
		color: '#666',
		marginBottom: 10,
	},
	statValue: {
		fontSize: 36,
		fontWeight: 'bold',
		color: '#007AFF',
		marginBottom: 5,
	},
	statLabel: {
		fontSize: 14,
		color: '#666',
	},
	statListItem: {
		fontSize: 16,
		color: '#333',
		paddingVertical: 8,
		borderBottomWidth: 1,
		borderBottomColor: '#eee',
	},
	congratsMessage: {
		fontSize: 16,
		color: '#3e8b00',
		textAlign: 'left',
		paddingVertical: 10,
		fontStyle: 'italic',
		fontWeight: '600',
	},
	toggleButtonActive: {
		backgroundColor: '#e8f2ff',
	},
});
