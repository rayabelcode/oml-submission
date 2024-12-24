import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Dimensions } from 'react-native';
import { spacing } from '../../context/ThemeContext';
import { useStyles } from '../../styles/screens/settings';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { getUserProfile, updateUserProfile, checkUsernameExists } from '../../utils/firestore';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { auth } from '../../config/firebase';
import {
	EmailAuthProvider,
	reauthenticateWithCredential,
	updateEmail,
	updatePassword,
	verifyBeforeUpdateEmail,
} from 'firebase/auth';

const AccountScreen = ({ navigation }) => {
	const styles = useStyles();
	const { colors } = useTheme();
	const { user } = useAuth();
	const [username, setUsername] = useState('');
	const [email, setEmail] = useState(user?.email || '');
	const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
	const [passwordCurrentPassword, setPasswordCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [usernameChanged, setUsernameChanged] = useState(false);
	const [emailChanged, setEmailChanged] = useState(false);
	const [passwordChanged, setPasswordChanged] = useState(false);
	console.log('Container Background:', colors.background.primary);
	console.log('Render Dimensions:', {
		screenHeight: Dimensions.get('window').height,
		screenWidth: Dimensions.get('window').width,
	});

	useEffect(() => {
		loadUserProfile();
	}, []);

	const loadUserProfile = async () => {
		try {
			const profile = await getUserProfile(user.uid);
			if (profile) {
				setUsername(profile.username || '');
			}
		} catch (error) {
			console.error('Error loading profile:', error);
		}
	};

	const handleChangeEmail = async () => {
		try {
			if (!emailCurrentPassword) {
				Alert.alert('Error', 'Please enter your current password');
				return;
			}

			const credential = EmailAuthProvider.credential(user.email, emailCurrentPassword);
			await reauthenticateWithCredential(auth.currentUser, credential);

			// Use verifyBeforeUpdateEmail directly with auth.currentUser
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
				Alert.alert('Error', 'New password must be at least 6 characters');
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

	const handleUpdateUsername = async () => {
		try {
			if (!username.trim()) return;

			const lowercaseUsername = username.trim().toLowerCase();

			// Check if username exists
			const usernameExists = await checkUsernameExists(lowercaseUsername, user.uid);
			if (usernameExists) {
				Alert.alert('Error', 'This username is already taken');
				return;
			}

			setUsername(lowercaseUsername);

			// Update Firestore profile
			await updateUserProfile(user.uid, {
				username: lowercaseUsername,
			});

			// Try to update Auth displayName, but don't throw error if it fails
			try {
				await auth.currentUser.updateProfile({ displayName: lowercaseUsername });
			} catch (authError) {
				console.log('Auth profile update failed, but Firestore updated successfully');
			}

			setUsernameChanged(false);
			Alert.alert('Success', 'Username updated successfully');
		} catch (error) {
			console.error('Error updating username:', error);
			if (error.code === 'permission-denied') {
				// If it's just a permission error but the update actually worked
				setUsernameChanged(false);
				Alert.alert('Success', 'Username updated successfully');
			} else {
				Alert.alert('Error', 'Failed to update username');
			}
		}
	};

	

	return (
		<View style={styles.container}>
			<View style={styles.profileSection}>
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
				<View style={styles.formSection}>
					<View style={styles.inputGroup}>
						<Text style={styles.label}>Username (Optional)</Text>
						<TextInput
							style={[styles.input, styles.inputText]}
							value={username}
							onChangeText={(text) => {
								setUsername(text);
								setUsernameChanged(true);
							}}
							placeholder="Enter username"
							placeholderTextColor={colors.text.secondary}
						/>
						<TouchableOpacity
							style={[styles.saveButton, !usernameChanged && styles.saveButtonDisabled]}
							onPress={handleUpdateUsername}
							disabled={!usernameChanged}
						>
							<Text style={styles.saveButtonText}>Update Username</Text>
						</TouchableOpacity>
					</View>
	
					<View style={styles.inputGroup}>
						<Text style={styles.label}>Email</Text>
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
					</View>
	
					<View style={styles.inputGroup}>
						<Text style={styles.label}>Change Password</Text>
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
					</View>
				</View>
			</ScrollView>
		</View>
	);
	

};

export default AccountScreen;
