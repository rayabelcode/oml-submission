import React, { useState, useEffect } from 'react';
import {
	StyleSheet,
	Text,
	View,
	ScrollView,
	TouchableOpacity,
	Switch,
	TextInput,
	Alert,
	Platform,
	Modal,
	ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image as ExpoImage } from 'expo-image';
import * as MailComposer from 'expo-mail-composer';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import {
	getUserProfile,
	uploadProfilePhoto,
	exportUserData,
	deleteUserAccount,
	updateUserProfile,
} from '../utils/firestore';

// Privacy Settings Modal Component
const PrivacyModal = ({ visible, onClose, onExportData, onDeleteAccount }) => (
	<Modal visible={visible} animationType="fade" transparent={true}>
		<View style={styles.modalContainer}>
			<View style={styles.modalContent}>
				<View style={styles.modalHeader}>
					<Text style={styles.modalTitle}>Privacy Settings</Text>
					<TouchableOpacity onPress={onClose}>
						<Icon name="close-outline" size={24} color="#666" />
					</TouchableOpacity>
				</View>

				<TouchableOpacity style={styles.privacyOption} onPress={onExportData}>
					<Icon name="download-outline" size={24} color="#007AFF" />
					<Text style={styles.privacyOptionText}>Export My Data</Text>
				</TouchableOpacity>

				<TouchableOpacity style={[styles.privacyOption, styles.deleteOption]} onPress={onDeleteAccount}>
					<Icon name="trash-outline" size={24} color="#FF3B30" />
					<Text style={[styles.privacyOptionText, styles.deleteText]}>Delete Account</Text>
				</TouchableOpacity>
			</View>
		</View>
	</Modal>
);

export default function SettingsScreen() {
	const { user, signIn, signUp, signOut } = useAuth();
	const [isLogin, setIsLogin] = useState(true);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [notificationsEnabled, setNotificationsEnabled] = useState(false);
	const [userProfile, setUserProfile] = useState(null);
	const [isPrivacyModalVisible, setIsPrivacyModalVisible] = useState(false);

	// Load user profile and notification status
	useEffect(() => {
		if (user) {
			loadUserProfile();
			checkNotificationStatus();
		}
	}, [user]);

	const loadUserProfile = async () => {
		try {
			const profile = await getUserProfile(user.uid);
			setUserProfile(profile);
		} catch (error) {
			console.error('Error loading profile:', error);
		}
	};

	const checkNotificationStatus = async () => {
		const { status } = await Notifications.getPermissionsAsync();
		setNotificationsEnabled(status === 'granted');
	};

	const handleNotificationToggle = async () => {
		try {
			if (notificationsEnabled) {
				await Notifications.setNotificationHandler(null);
				setNotificationsEnabled(false);
				await updateUserProfile(user.uid, { notifications_enabled: false });
			} else {
				const { status } = await Notifications.requestPermissionsAsync();
				if (status === 'granted') {
					await Notifications.setNotificationHandler({
						handleNotification: async () => ({
							shouldShowAlert: true,
							shouldPlaySound: true,
							shouldSetBadge: true,
						}),
					});
					setNotificationsEnabled(true);
					await updateUserProfile(user.uid, { notifications_enabled: true });
				}
			}
		} catch (error) {
			console.error('Error toggling notifications:', error);
			Alert.alert('Error', 'Failed to update notification settings');
		}
	};

	const handleProfilePhotoUpload = async () => {
		try {
			const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
			if (status !== 'granted') {
				Alert.alert('Permission needed', 'Please grant permission to access your photos');
				return;
			}

			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ImagePicker.MediaType.Images,
				allowsEditing: true,
				aspect: [1, 1],
				quality: 0.5,
			});

			if (!result.canceled && result.assets[0].uri) {
				const manipResult = await ImageManipulator.manipulateAsync(
					result.assets[0].uri,
					[{ resize: { width: 300, height: 300 } }],
					{ compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
				);

				const photoUrl = await uploadProfilePhoto(user.uid, manipResult.uri);
				if (photoUrl) {
					await loadUserProfile();
				} else {
					Alert.alert('Error', 'Failed to upload photo');
				}
			}
		} catch (error) {
			console.error('Error uploading photo:', error);
			Alert.alert('Error', 'Failed to upload photo');
		}
	};

	const handleSupport = async () => {
		try {
			const deviceInfo = `
                App Version: ${Constants.expoConfig.version}
                Platform: ${Platform.OS}
                Device: ${Platform.OS === 'ios' ? 'iOS' : 'Android'}
                User ID: ${user.uid}
            `;

			const isAvailable = await MailComposer.isAvailableAsync();

			if (isAvailable) {
				await MailComposer.composeAsync({
					recipients: ['ray.abel@gmail.com'],
					subject: 'OnMyList Support Request',
					body: `\n\n\n---------------\nDevice Information:\n${deviceInfo}`,
				});
			} else {
				Alert.alert('Error', 'Email is not available on this device');
			}
		} catch (error) {
			console.error('Error sending email:', error);
			Alert.alert('Error', 'Failed to open email composer');
		}
	};

	const handleExportData = async () => {
		try {
			setLoading(true);
			const userData = await exportUserData(user.uid);

			const fileUri = `${FileSystem.documentDirectory}onmylist_export.csv`;
			let csvContent = 'First Name,Last Name,Email,Phone,Tags,Next Contact,Notes,Contact History\n';

			userData.contacts.forEach((contact) => {
				const historyString =
					contact.contact_history
						?.map((h) => `${new Date(h.date).toLocaleDateString()}: ${h.notes.replace(/"/g, '""')}`)
						.join('; ') || '';

				csvContent += `"${contact.first_name || ''}","${contact.last_name || ''}","${contact.email || ''}","${
					contact.phone || ''
				}","${contact.tags?.join(';') || ''}","${contact.next_contact || ''}","${(
					contact.notes || ''
				).replace(/"/g, '""')}","${historyString}"\n`;
			});

			await FileSystem.writeAsStringAsync(fileUri, csvContent);

			if (Platform.OS === 'ios') {
				await Sharing.shareAsync(fileUri);
			} else {
				await Sharing.shareAsync(fileUri, {
					mimeType: 'text/csv',
					dialogTitle: 'Export OnMyList Data',
				});
			}
		} catch (error) {
			console.error('Error exporting data:', error);
			Alert.alert('Error', 'Failed to export data');
		} finally {
			setLoading(false);
		}
	};

	const handleDeleteAccount = () => {
		Alert.alert(
			'Delete Account',
			'Are you sure you want to delete your account? This action cannot be undone and will delete all your contacts and data.',
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Delete',
					style: 'destructive',
					onPress: async () => {
						try {
							setLoading(true);
							await deleteUserAccount(user.uid);
							await user.delete();
							await signOut();
						} catch (error) {
							console.error('Error deleting account:', error);
							Alert.alert('Error', 'Failed to delete account');
						} finally {
							setLoading(false);
						}
					},
				},
			]
		);
	};

	async function handleAuth() {
		if (loading) return;

		if (!email || !password) {
			Alert.alert('Error', 'Please fill in all fields');
			return;
		}

		if (!isLogin && password.length < 6) {
			Alert.alert('Error', 'Password must be at least 6 characters');
			return;
		}

		setLoading(true);
		try {
			if (isLogin) {
				const { error } = await signIn({
					email: email.trim(),
					password: password.trim(),
				});
				if (error) throw error;
			} else {
				const { error } = await signUp({
					email: email.trim(),
					password: password.trim(),
				});
				if (error) throw error;

				Alert.alert('Success', 'Registration successful! Please check your email for verification.', [
					{
						text: 'OK',
						onPress: () => {
							setIsLogin(true);
							setEmail('');
							setPassword('');
						},
					},
				]);
			}
		} catch (error) {
			console.error('Auth error:', error);
			let errorMessage = error.message;
			if (error.code === 'auth/email-already-in-use') {
				errorMessage = 'This email is already registered.';
			} else if (error.code === 'auth/invalid-email') {
				errorMessage = 'Please enter a valid email address.';
			} else if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
				errorMessage = 'Invalid email or password.';
			}
			Alert.alert('Error', errorMessage);
		} finally {
			setLoading(false);
		}
	}

	async function handleLogout() {
		try {
			const { error } = await signOut();
			if (error) throw error;
		} catch (error) {
			Alert.alert('Error', error.message);
		}
	}

	if (!user) {
		return (
			<View style={styles.container}>
				<StatusBar style="auto" />
				<View style={styles.loginContainer}>
					<Text style={styles.loginTitle}>{isLogin ? 'Login to OnMyList' : 'Create Account'}</Text>

					<View style={styles.inputContainer}>
						<Icon name="mail-outline" size={20} color="#666" />
						<TextInput
							style={styles.input}
							placeholder="Email"
							value={email}
							onChangeText={setEmail}
							autoCapitalize="none"
							keyboardType="email-address"
						/>
					</View>

					<View style={styles.inputContainer}>
						<Icon name="key-outline" size={20} color="#666" />
						<TextInput
							style={styles.input}
							placeholder="Password"
							value={password}
							onChangeText={setPassword}
							secureTextEntry
						/>
					</View>

					<TouchableOpacity style={styles.loginButton} onPress={handleAuth} disabled={loading}>
						<Text style={styles.loginButtonText}>
							{loading ? 'Loading...' : isLogin ? 'Sign In' : 'Sign Up'}
						</Text>
					</TouchableOpacity>

					<TouchableOpacity style={styles.switchButton} onPress={() => setIsLogin(!isLogin)}>
						<Text style={styles.switchButtonText}>
							{isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
						</Text>
					</TouchableOpacity>
				</View>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<StatusBar style="auto" />

			<View style={styles.profileSection}>
				<TouchableOpacity style={styles.avatar} onPress={handleProfilePhotoUpload}>
					{userProfile?.photo_url ? (
						<ExpoImage
							source={{ uri: userProfile.photo_url }}
							style={styles.avatarImage}
							cachePolicy="memory-disk"
						/>
					) : (
						<Icon name="person-outline" size={40} color="#007AFF" />
					)}
					<View style={styles.editOverlay}>
						<Icon name="camera-outline" size={20} color="#fff" />
					</View>
				</TouchableOpacity>
				<View style={styles.profileInfo}>
					<Text style={styles.profileEmail}>Account Info</Text>
					<Text style={styles.profileName}>{user.email}</Text>
				</View>
			</View>

			<ScrollView style={styles.settingsList}>
				<View style={styles.settingSection}>
					<Text style={styles.sectionTitle}>Notifications</Text>
					<View style={styles.settingItem}>
						<View style={styles.settingItemLeft}>
							<Icon name="notifications-outline" size={20} color="#666" />
							<Text style={styles.settingText}>Push Notifications</Text>
						</View>
						<Switch
							value={notificationsEnabled}
							onValueChange={handleNotificationToggle}
							trackColor={{ false: '#767577', true: '#81b0ff' }}
							thumbColor={notificationsEnabled ? '#007AFF' : '#f4f3f4'}
						/>
					</View>
				</View>

				<View style={styles.settingSection}>
					<Text style={styles.sectionTitle}>Privacy</Text>
					<TouchableOpacity style={styles.settingItem} onPress={() => setIsPrivacyModalVisible(true)}>
						<View style={styles.settingItemLeft}>
							<Icon name="lock-closed-outline" size={20} color="#666" />
							<Text style={styles.settingText}>Privacy Settings</Text>
						</View>
						<Icon name="chevron-forward-outline" size={20} color="#666" />
					</TouchableOpacity>
				</View>

				<View style={styles.settingSection}>
					<Text style={styles.sectionTitle}>Support</Text>
					<TouchableOpacity style={styles.settingItem} onPress={handleSupport}>
						<View style={styles.settingItemLeft}>
							<Icon name="help-circle-outline" size={20} color="#666" />
							<Text style={styles.settingText}>Help Center</Text>
						</View>
						<Icon name="chevron-forward-outline" size={20} color="#666" />
					</TouchableOpacity>
				</View>

				<TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
					<Icon name="log-out-outline" size={20} color="#FF3B30" />
					<Text style={styles.logoutText}>Log Out</Text>
				</TouchableOpacity>
			</ScrollView>

			<PrivacyModal
				visible={isPrivacyModalVisible}
				onClose={() => setIsPrivacyModalVisible(false)}
				onExportData={handleExportData}
				onDeleteAccount={handleDeleteAccount}
			/>

			{loading && (
				<View style={styles.loadingOverlay}>
					<ActivityIndicator size="large" color="#007AFF" />
				</View>
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
	profileSection: {
		flexDirection: 'row',
		padding: 20,
		backgroundColor: '#f8f9fa',
		alignItems: 'center',
	},
	avatar: {
		width: 60,
		height: 60,
		borderRadius: 30,
		backgroundColor: '#e9ecef',
		justifyContent: 'center',
		alignItems: 'center',
		position: 'relative',
	},
	avatarImage: {
		width: '100%',
		height: '100%',
		borderRadius: 30,
	},
	editOverlay: {
		position: 'absolute',
		bottom: -5,
		right: -5,
		backgroundColor: '#007AFF',
		borderRadius: 12,
		padding: 5,
	},
	profileInfo: {
		marginLeft: 15,
	},
	profileName: {
		fontSize: 18,
		fontWeight: 'bold',
	},
	profileEmail: {
		color: '#666',
	},
	settingsList: {
		flex: 1,
	},
	settingSection: {
		padding: 15,
		borderBottomWidth: 1,
		borderBottomColor: '#eee',
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: '500',
		marginBottom: 10,
		color: '#666',
	},
	settingItem: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 10,
	},
	settingItemLeft: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	settingText: {
		marginLeft: 15,
		fontSize: 16,
	},
	logoutButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 15,
		margin: 15,
		backgroundColor: '#fff',
		borderRadius: 10,
		borderWidth: 1,
		borderColor: '#FF3B30',
	},
	logoutText: {
		color: '#FF3B30',
		marginLeft: 10,
		fontSize: 16,
		fontWeight: '500',
	},
	loginContainer: {
		flex: 1,
		padding: 20,
		justifyContent: 'center',
	},
	loginTitle: {
		fontSize: 24,
		fontWeight: 'bold',
		marginBottom: 30,
		textAlign: 'center',
	},
	inputContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 10,
		paddingHorizontal: 15,
		marginBottom: 15,
	},
	input: {
		flex: 1,
		padding: 15,
		marginLeft: 10,
		fontSize: 16,
	},
	loginButton: {
		backgroundColor: '#007AFF',
		padding: 15,
		borderRadius: 10,
		marginTop: 15,
	},
	loginButtonText: {
		color: '#fff',
		textAlign: 'center',
		fontSize: 16,
		fontWeight: '500',
	},
	switchButton: {
		marginTop: 15,
		padding: 10,
	},
	switchButtonText: {
		color: '#007AFF',
		textAlign: 'center',
		fontSize: 14,
	},
	modalContainer: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		padding: 20,
	},
	modalContent: {
		backgroundColor: 'white',
		borderRadius: 20,
		padding: 20,
	},
	modalHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 20,
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: 'bold',
	},
	privacyOption: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 15,
		borderBottomWidth: 1,
		borderBottomColor: '#eee',
	},
	privacyOptionText: {
		marginLeft: 15,
		fontSize: 16,
		color: '#007AFF',
	},
	deleteOption: {
		borderBottomWidth: 0,
	},
	deleteText: {
		color: '#FF3B30',
	},
	loadingOverlay: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(255, 255, 255, 0.8)',
		justifyContent: 'center',
		alignItems: 'center',
	},
});
