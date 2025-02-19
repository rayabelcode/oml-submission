import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Linking } from 'react-native';
import { useStyles } from '../../styles/screens/settings';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { getUserProfile, updateUserProfile, checkUsernameExists } from '../../utils/firestore';
import { auth } from '../../config/firebase';
import {
	EmailAuthProvider,
	reauthenticateWithCredential,
	updateEmail,
	updatePassword,
	verifyBeforeUpdateEmail,
} from 'firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';

const AccountScreen = ({ navigation }) => {
	const styles = useStyles();
	const { colors, spacing } = useTheme();
	const { user } = useAuth();
	const [username, setUsername] = useState('');
	const [email, setEmail] = useState(user?.email || '');
	const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
	const [passwordCurrentPassword, setPasswordCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [usernameChanged, setUsernameChanged] = useState(false);
	const [emailChanged, setEmailChanged] = useState(false);
	// State to track if user is signed in with Apple
	const [isAppleUser, setIsAppleUser] = useState(false);

	// Open Apple ID settings
	const openAppleSettings = () => {
		Linking.openURL('App-Prefs:APPLE_ACCOUNT').catch(() => {
			Alert.alert(
				'Unable to Open Settings',
				'To manage your Apple ID:\n1. Open Settings\n2. Tap your name at the top\n3. Select "Password & Security"'
			);
		});
	};

	// Load user profile and check auth provider
	useEffect(() => {
		setIsAppleUser(user?.providerData[0]?.providerId === 'apple.com');
		loadUserProfile();
	}, []);

	const loadUserProfile = async () => {
		try {
			const profile = await getUserProfile(user.uid);
			if (profile?.username) {
				setUsername(profile.username);
			} else {
				console.warn('No username found in Firestore.');
			}
		} catch (error) {
			console.error('Error loading profile:', error);
			Alert.alert('Error', 'Failed to load username. Please try again.');
		}
	};

	useEffect(() => {
		const unsubscribe = navigation.addListener('focus', loadUserProfile);
		return unsubscribe;
	}, [navigation]);

	const handleUpdateUsername = async () => {
		try {
			if (!username.trim()) {
				Alert.alert('Error', 'Username cannot be empty.');
				return;
			}

			const lowercaseUsername = username.trim().toLowerCase();

			const profile = await getUserProfile(user.uid);
			if (profile?.username === lowercaseUsername) {
				Alert.alert('No Changes', 'The username is already up to date.');
				return;
			}

			const usernameExists = await checkUsernameExists(lowercaseUsername, user.uid);
			if (usernameExists) {
				Alert.alert('Error', 'This username is already taken.');
				return;
			}

			await updateUserProfile(user.uid, { username: lowercaseUsername });

			setUsername(lowercaseUsername);
			setUsernameChanged(false);

			Alert.alert('Success', 'Username updated successfully.');
		} catch (error) {
			console.error('Error updating username:', error);
			Alert.alert('Error', 'Failed to update username. Please try again.');
		}
	};

	const handleChangeEmail = async () => {
		// Prevent email changes for Apple users
		if (isAppleUser) {
			Alert.alert('Apple Sign In', 'Email management is handled through your Apple ID settings.');
			return;
		}

		try {
			if (!emailCurrentPassword) {
				Alert.alert('Error', 'Please enter your current password');
				return;
			}

			const credential = EmailAuthProvider.credential(user.email, emailCurrentPassword);
			await reauthenticateWithCredential(auth.currentUser, credential);

			await verifyBeforeUpdateEmail(auth.currentUser, email);

			Alert.alert(
				'Verification Required',
				'A verification link has been sent to your new email address. Please verify it before the change will take effect.'
			);
			setEmailCurrentPassword('');
			setEmailChanged(false);
		} catch (error) {
			console.error('Error updating email:', error);
			Alert.alert('Error', 'Failed to update email. Please check your password and try again.');
		}
	};

	const handleChangePassword = async () => {
		// Prevent password changes for Apple users
		if (isAppleUser) {
			Alert.alert('Apple Sign In', 'Password management is handled through your Apple ID settings.');
			return;
		}

		try {
			if (!passwordCurrentPassword || !newPassword || !confirmPassword) {
				Alert.alert('Error', 'Please fill in all password fields');
				return;
			}

			if (newPassword !== confirmPassword) {
				Alert.alert('Error', 'New passwords do not match');
				return;
			}

			if (newPassword.length < 6) {
				Alert.alert('Error', 'New password must be at least 8 characters');
				return;
			}

			const credential = EmailAuthProvider.credential(user.email, passwordCurrentPassword);
			await reauthenticateWithCredential(auth.currentUser, credential);
			await updatePassword(auth.currentUser, newPassword);

			Alert.alert('Success', 'Password updated successfully');
			setPasswordCurrentPassword('');
			setNewPassword('');
			setConfirmPassword('');
			setEmailChanged(false);
		} catch (error) {
			console.error('Error updating password:', error);
			Alert.alert('Error', 'Failed to update password. Please check your current password and try again.');
		}
	};

	return (
		<View style={styles.container}>
			<View style={styles.headerSettingsPages}>
				<TouchableOpacity style={styles.settingItemLeft} onPress={() => navigation.goBack()}>
					<Icon name="chevron-back" size={24} color={colors.text.primary} />
					<Text style={styles.profileName}>Account</Text>
				</TouchableOpacity>
			</View>

			<ScrollView
				style={styles.settingsList}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="interactive"
				automaticallyAdjustKeyboardInsets={true}
			>
				{/* Username Section */}
				<View style={styles.card}>
					<Text style={[styles.sectionTitle, { color: colors.primary, textAlign: 'center' }]}>Username</Text>
					<TextInput
						style={[styles.input, styles.inputText]}
						value={username}
						onChangeText={(text) => {
							setUsername(text);
							setUsernameChanged(true);
						}}
						placeholder="Enter username"
						placeholderTextColor={colors.text.secondary}
						autoCorrect={false}
						autoCapitalize="none"
					/>
					<TouchableOpacity
						style={[styles.saveButton, !usernameChanged && styles.saveButtonDisabled]}
						onPress={handleUpdateUsername}
						disabled={!usernameChanged}
					>
						<Text style={styles.saveButtonText}>Update Username</Text>
					</TouchableOpacity>
				</View>

				{/* Email Section */}
				<View style={styles.card}>
					<Text style={[styles.sectionTitle, { color: colors.primary, textAlign: 'center' }]}>Email</Text>
					<Text style={[styles.input, styles.inputText]}>{email}</Text>
					{!isAppleUser && (
						<>
							<TextInput
								style={[styles.input, styles.inputText]}
								value={email}
								onChangeText={(text) => {
									setEmail(text);
									setEmailChanged(true);
								}}
								placeholder="Enter new email"
								placeholderTextColor={colors.text.secondary}
								keyboardType="email-address"
								autoCorrect={false}
								autoCapitalize="none"
							/>
							<TextInput
								style={[styles.input, styles.inputText, { marginTop: spacing.sm }]}
								value={emailCurrentPassword}
								onChangeText={setEmailCurrentPassword}
								placeholder="Enter current password"
								placeholderTextColor={colors.text.secondary}
								secureTextEntry
							/>
							<TouchableOpacity
								style={[
									styles.saveButton,
									(!emailChanged || !emailCurrentPassword) && styles.saveButtonDisabled,
								]}
								onPress={handleChangeEmail}
								disabled={!emailChanged || !emailCurrentPassword}
							>
								<Text style={styles.saveButtonText}>Update Email</Text>
							</TouchableOpacity>
						</>
					)}
					{isAppleUser && (
						<TouchableOpacity onPress={openAppleSettings}>
							<Text style={[styles.helperText, { textAlign: 'center', marginTop: spacing.sm }]}>
								Email is managed through Apple ID settings
							</Text>
						</TouchableOpacity>
					)}
				</View>

				{/* Password Section */}
				<View style={styles.card}>
					<Text style={[styles.sectionTitle, { color: colors.primary, textAlign: 'center' }]}>
						Change Password
					</Text>
					{!isAppleUser && (
						<>
							<TextInput
								style={[styles.input, styles.inputText]}
								value={passwordCurrentPassword}
								onChangeText={setPasswordCurrentPassword}
								placeholder="Current password"
								placeholderTextColor={colors.text.secondary}
								secureTextEntry
							/>
							<TextInput
								style={[styles.input, styles.inputText, { marginTop: spacing.sm }]}
								value={newPassword}
								onChangeText={setNewPassword}
								placeholder="New password"
								placeholderTextColor={colors.text.secondary}
								secureTextEntry
							/>
							<TextInput
								style={[styles.input, styles.inputText, { marginTop: spacing.sm }]}
								value={confirmPassword}
								onChangeText={setConfirmPassword}
								placeholder="Confirm new password"
								placeholderTextColor={colors.text.secondary}
								secureTextEntry
							/>
							<TouchableOpacity
								style={[
									styles.saveButton,
									(!passwordCurrentPassword || !newPassword || !confirmPassword) && styles.saveButtonDisabled,
								]}
								onPress={handleChangePassword}
								disabled={!passwordCurrentPassword || !newPassword || !confirmPassword}
							>
								<Text style={styles.saveButtonText}>Update Password</Text>
							</TouchableOpacity>
						</>
					)}
					{isAppleUser && (
						<TouchableOpacity onPress={openAppleSettings}>
							<Text style={[styles.helperText, { textAlign: 'center', marginTop: spacing.sm }]}>
								Password is managed through Apple ID settings
							</Text>
						</TouchableOpacity>
					)}
				</View>
			</ScrollView>
		</View>
	);
};

export default AccountScreen;
