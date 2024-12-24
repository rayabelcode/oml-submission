import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { useStyles } from '../../styles/screens/settings';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { getUserProfile, updateUserProfile } from '../../utils/firestore';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { auth } from '../../config/firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updateEmail, updatePassword } from 'firebase/auth';

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
	const [hasChanges, setHasChanges] = useState(false);

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
			await updateEmail(auth.currentUser, email);

			Alert.alert('Success', 'Email updated successfully');
			setEmailCurrentPassword('');
			setHasChanges(false);
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
			setHasChanges(false);
		} catch (error) {
			console.error('Error updating password:', error);
			Alert.alert('Error', 'Failed to update password. Please check your current password and try again.');
		}
	};

	const handleUpdateUsername = async () => {
		try {
			await updateUserProfile(user.uid, {
				username: username.trim().toLowerCase(),
			});
			setHasChanges(false);
			Alert.alert('Success', 'Username updated successfully');
		} catch (error) {
			console.error('Error updating username:', error);
			Alert.alert('Error', 'Failed to update username');
		}
	};

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
			style={styles.container}
			keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
		>
			<View style={styles.profileSection}>
				<TouchableOpacity style={styles.settingItemLeft} onPress={() => navigation.goBack()}>
					<Icon name="chevron-back" size={24} color={colors.text.primary} />
					<Text style={styles.profileName}>Account</Text>
				</TouchableOpacity>
			</View>

			<ScrollView style={styles.settingsList} keyboardShouldPersistTaps="handled">
				<View style={styles.formSection}>
					<View style={styles.inputGroup}>
						<Text style={styles.label}>Username (Optional)</Text>
						<TextInput
							style={[styles.input, styles.inputText]}
							value={username}
							onChangeText={(text) => {
								setUsername(text);
								setHasChanges(true);
							}}
							placeholder="Enter username"
							placeholderTextColor={colors.text.secondary}
						/>
						<TouchableOpacity
							style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
							onPress={handleUpdateUsername}
							disabled={!hasChanges}
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
								setHasChanges(true);
							}}
							placeholder="Enter new email"
							placeholderTextColor={colors.text.secondary}
							keyboardType="email-address"
							autoCapitalize="none"
						/>
						<TextInput
							style={[styles.input, styles.inputText]}
							value={emailCurrentPassword}
							onChangeText={setEmailCurrentPassword}
							placeholder="Enter current password"
							placeholderTextColor={colors.text.secondary}
							secureTextEntry
						/>
						<TouchableOpacity
							style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
							onPress={handleChangeEmail}
							disabled={!hasChanges || !emailCurrentPassword}
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
							style={[styles.input, styles.inputText]}
							value={newPassword}
							onChangeText={setNewPassword}
							placeholder="New password"
							placeholderTextColor={colors.text.secondary}
							secureTextEntry
						/>
						<TextInput
							style={[styles.input, styles.inputText]}
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
		</KeyboardAvoidingView>
	);
};

export default AccountScreen;
