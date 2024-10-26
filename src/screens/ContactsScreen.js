import React, { useState, useEffect } from 'react';
import {
	StyleSheet,
	Text,
	View,
	ScrollView,
	TouchableOpacity,
	TextInput,
	RefreshControl,
	Alert,
	Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Search, Plus, Phone, Mail, Clock, User, Trash2 } from 'lucide-react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../context/AuthContext';

export default function ContactsScreen() {
	const { user } = useAuth();
	const [contacts, setContacts] = useState([]);
	const [searchQuery, setSearchQuery] = useState('');
	const [refreshing, setRefreshing] = useState(false);
	const [loading, setLoading] = useState(true);

	async function fetchContacts() {
		try {
			if (!user) return;

			const { data, error } = await supabase
				.from('contacts')
				.select('*')
				.eq('user_id', user.id)
				.ilike('name', `%${searchQuery}%`)
				.order('name');

			if (error) throw error;
			setContacts(data || []);
		} catch (error) {
			console.error('Error fetching contacts:', error.message);
			Alert.alert('Error', 'Failed to load contacts');
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		fetchContacts();
	}, [user, searchQuery]);

	const onRefresh = React.useCallback(async () => {
		setRefreshing(true);
		await fetchContacts();
		setRefreshing(false);
	}, []);

	const handleCall = async (phone) => {
		try {
			await Linking.openURL(`tel:${phone}`);
		} catch (error) {
			Alert.alert('Error', 'Could not open phone app');
		}
	};

	const handleEmail = async (email) => {
		try {
			await Linking.openURL(`mailto:${email}`);
		} catch (error) {
			Alert.alert('Error', 'Could not open email app');
		}
	};

	const handleDeleteContact = async (contactId) => {
		try {
			Alert.alert('Delete Contact', 'Are you sure you want to delete this contact?', [
				{
					text: 'Cancel',
					style: 'cancel',
				},
				{
					text: 'Delete',
					style: 'destructive',
					onPress: async () => {
						const { error } = await supabase.from('contacts').delete().eq('id', contactId);

						if (error) throw error;
						fetchContacts();
					},
				},
			]);
		} catch (error) {
			console.error('Error deleting contact:', error.message);
			Alert.alert('Error', 'Failed to delete contact');
		}
	};

	const ContactCard = ({ id, name, email, phone, frequency, last_contact }) => (
		<TouchableOpacity
			style={styles.contactCard}
			onPress={() => {
				Alert.alert(name, `Frequency: ${frequency || 'Not set'}\n${email || ''}\n${phone || ''}`, [
					{ text: 'Cancel', style: 'cancel' },
					{
						text: 'Delete',
						onPress: () => handleDeleteContact(id),
						style: 'destructive',
					},
				]);
			}}
		>
			<View style={styles.contactHeader}>
				<View style={styles.avatarContainer}>
					<User size={24} color="#007AFF" />
				</View>
				<View style={styles.contactInfo}>
					<Text style={styles.contactName}>{name}</Text>
					{last_contact && (
						<Text style={styles.contactDetail}>
							Last Contact: {new Date(last_contact).toLocaleDateString()}
						</Text>
					)}
					<Text style={styles.contactDetail}>Frequency: {frequency || 'Not set'}</Text>
				</View>
			</View>
			<View style={styles.contactActions}>
				{phone && (
					<TouchableOpacity style={styles.actionIcon} onPress={() => handleCall(phone)}>
						<Phone size={20} color="#007AFF" />
					</TouchableOpacity>
				)}
				{email && (
					<TouchableOpacity style={styles.actionIcon} onPress={() => handleEmail(email)}>
						<Mail size={20} color="#007AFF" />
					</TouchableOpacity>
				)}
				<TouchableOpacity
					style={styles.actionIcon}
					onPress={() => Alert.alert('Coming Soon', 'This feature is under development')}
				>
					<Clock size={20} color="#007AFF" />
				</TouchableOpacity>
				<TouchableOpacity
					style={[styles.actionIcon, { marginLeft: 10 }]}
					onPress={() => handleDeleteContact(id)}
				>
					<Trash2 size={20} color="#FF3B30" />
				</TouchableOpacity>
			</View>
		</TouchableOpacity>
	);

	if (!user) {
		return (
			<View style={styles.container}>
				<Text style={styles.message}>Please log in to view your contacts</Text>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<StatusBar style="auto" />

			<View style={styles.searchContainer}>
				<Search size={20} color="#666" style={styles.searchIcon} />
				<TextInput
					style={styles.searchInput}
					placeholder="Search contacts..."
					value={searchQuery}
					onChangeText={setSearchQuery}
					clearButtonMode="while-editing"
				/>
			</View>

			<TouchableOpacity
				style={styles.addButton}
				onPress={() => Alert.alert('Coming Soon', 'This feature is under development')}
			>
				<Plus size={20} color="#fff" />
				<Text style={styles.addButtonText}>Add New Contact</Text>
			</TouchableOpacity>

			<ScrollView
				style={styles.contactsList}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
			>
				{loading ? (
					<Text style={styles.message}>Loading contacts...</Text>
				) : contacts.length === 0 ? (
					<Text style={styles.message}>{searchQuery ? 'No contacts found' : 'No contacts yet'}</Text>
				) : (
					contacts.map((contact) => <ContactCard key={contact.id} {...contact} />)
				)}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#fff',
	},
	searchContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 15,
		backgroundColor: '#f8f9fa',
	},
	searchIcon: {
		marginRight: 10,
	},
	searchInput: {
		flex: 1,
		height: 40,
		backgroundColor: '#fff',
		borderRadius: 20,
		paddingHorizontal: 15,
		borderWidth: 1,
		borderColor: '#ddd',
	},
	addButton: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#007AFF',
		margin: 15,
		padding: 15,
		borderRadius: 10,
		justifyContent: 'center',
	},
	addButtonText: {
		color: '#fff',
		marginLeft: 10,
		fontWeight: '500',
	},
	contactsList: {
		flex: 1,
		padding: 15,
	},
	contactCard: {
		backgroundColor: '#f8f9fa',
		padding: 15,
		borderRadius: 10,
		marginBottom: 10,
		borderWidth: 1,
		borderColor: '#eee',
	},
	contactHeader: {
		flexDirection: 'row',
		marginBottom: 10,
	},
	avatarContainer: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: '#e8f2ff',
		justifyContent: 'center',
		alignItems: 'center',
		marginRight: 10,
	},
	contactInfo: {
		flex: 1,
	},
	contactName: {
		fontSize: 18,
		fontWeight: '500',
		marginBottom: 5,
	},
	contactDetail: {
		color: '#666',
		fontSize: 14,
	},
	contactActions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		borderTopWidth: 1,
		borderTopColor: '#eee',
		paddingTop: 10,
		marginTop: 5,
	},
	actionIcon: {
		marginLeft: 15,
		padding: 5,
	},
	message: {
		textAlign: 'center',
		padding: 20,
		color: '#666',
	},
});
