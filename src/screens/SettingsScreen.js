import React, { useState, useEffect } from 'react';
import { View, Alert, ActivityIndicator, Platform } from 'react-native';
import { useStyles } from '../styles/screens/settings';
import { useTheme } from '../context/ThemeContext'; // Dark mode
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
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
import PrivacyModal from '../components/settings/PrivacyModal';
import AuthSection from '../components/settings/AuthSection';
import ProfileSection from '../components/settings/ProfileSection';
import SettingsList from '../components/settings/SettingsList';
import { useFocusEffect } from '@react-navigation/native';

export default function SettingsScreen({ navigation }) {
	const styles = useStyles();
	const { user, signIn, signUp, signOut, resetPassword, signInWithApple } = useAuth();
	const [isLogin, setIsLogin] = useState(true);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [notificationsEnabled, setNotificationsEnabled] = useState(false);
	const [userProfile, setUserProfile] = useState(null);
	const [isPrivacyModalVisible, setIsPrivacyModalVisible] = useState(false);
	const { theme, toggleTheme, colors } = useTheme();
	const isDarkMode = theme === 'dark';

	useEffect(() => {
		if (user) {
			loadUserProfile();
			checkNotificationStatus();
		}
	}, [user]);

	useFocusEffect(
		React.useCallback(() => {
			if (user) {
				loadUserProfile();
			}
		}, [user])
	);

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

	const handleProfilePress = () => {
		navigation.navigate('Profile');
	};

	const handleAccountPress = () => {
		navigation.navigate('Account');
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
				mediaTypes: ['images'],
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
			let errorMessage;
			switch (error.code) {
				case 'auth/email-already-in-use':
					errorMessage = 'This email is already registered';
					break;
				case 'auth/invalid-email':
					errorMessage = 'Please enter a valid email address';
					break;
				case 'auth/wrong-password':
				case 'auth/user-not-found':
				case 'auth/invalid-credential':
					errorMessage = 'Invalid email or password';
					break;
				case 'auth/too-many-requests':
					errorMessage = 'Too many failed attempts. Please try again later';
					break;
				case 'auth/network-request-failed':
					errorMessage = 'Network error. Please check your connection';
					break;
				default:
					errorMessage = 'An error occurred. Please try again';
			}
			Alert.alert('Error', errorMessage);
		} finally {
			setLoading(false);
		}
	}

	const handleForgotPassword = async () => {
		if (!email.trim()) {
			Alert.alert('Error', 'Please enter your email address');
			return;
		}

		setLoading(true);
		try {
			const { error } = await resetPassword(email.trim());
			if (error) throw error;

			Alert.alert(
				'Password Reset Email Sent',
				"Check your email for a link to reset your password. If you don't see it, check your spam folder.",
				[{ text: 'OK' }]
			);
		} catch (error) {
			console.error('Reset password error:', error);
			let errorMessage;
			switch (error.code) {
				case 'auth/invalid-email':
					errorMessage = 'Please enter a valid email address';
					break;
				case 'auth/user-not-found':
					errorMessage = 'No account found with this email';
					break;
				default:
					errorMessage = 'Unable to send reset password email. Please try again.';
			}
			Alert.alert('Error', errorMessage);
		} finally {
			setLoading(false);
		}
	};

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
			<AuthSection
				isLogin={isLogin}
				setIsLogin={setIsLogin}
				email={email}
				setEmail={setEmail}
				password={password}
				setPassword={setPassword}
				handleAuth={handleAuth}
				loading={loading}
				onForgotPassword={handleForgotPassword}
				signInWithApple={signInWithApple}
			/>
		);
	}

	return (
		<View style={styles.container}>
			<StatusBar style="auto" />

			<ProfileSection
				userProfile={userProfile}
				user={user}
				handleProfilePhotoUpload={handleProfilePhotoUpload}
			/>

			<SettingsList
				notificationsEnabled={notificationsEnabled}
				handleNotificationToggle={handleNotificationToggle}
				setIsPrivacyModalVisible={setIsPrivacyModalVisible}
				handleSupport={handleSupport}
				handleLogout={handleLogout}
				isDarkMode={isDarkMode}
				handleThemeToggle={toggleTheme}
				onProfilePress={handleProfilePress}
				onAccountPress={handleAccountPress}
			/>

			<PrivacyModal
				visible={isPrivacyModalVisible}
				onClose={() => setIsPrivacyModalVisible(false)}
				onExportData={handleExportData}
				onDeleteAccount={handleDeleteAccount}
			/>

			{loading && (
				<View style={styles.loadingOverlay}>
					<ActivityIndicator size="large" color={colors.primary} />
				</View>
			)}
		</View>
	);
}
