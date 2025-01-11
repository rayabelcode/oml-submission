import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { useStyles } from '../../styles/screens/settings';
import { useTheme } from '../../context/ThemeContext'; // Import ThemeContext
import Icon from 'react-native-vector-icons/Ionicons';
import ImagePickerComponent from '../../components/general/ImagePicker';
import { useAuth } from '../../context/AuthContext';
import {
	getUserProfile,
	updateUserProfile,
	uploadProfilePhoto,
	cleanupSubscriptions,
} from '../../utils/firestore';
import { cacheManager } from '../../utils/cache';

const ProfileScreen = ({ navigation }) => {
	const styles = useStyles();
	const { colors, spacing, layout } = useTheme(); // Access colors, spacing, and layout from ThemeContext
	const { user, signOut } = useAuth();
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const profilePhotoRef = useRef(null);
	const [hasChanges, setHasChanges] = useState(false);
	const lastNameInputRef = useRef(null);

	const handleLogout = async () => {
		Alert.alert(
			'Confirm Logout',
			'Are you sure you want to log out?',
			[
				{
					text: 'Cancel',
					style: 'cancel',
				},
				{
					text: 'Log Out',
					style: 'destructive',
					onPress: async () => {
						try {
							// Clean up subscriptions before signing out
							cleanupSubscriptions();
							const { error } = await signOut();
							if (error) throw error;
						} catch (error) {
							Alert.alert('Error', error.message);
						}
					},
				},
			],
			{ cancelable: true }
		);
	};

	const loadUserProfile = useCallback(async () => {
		try {
			const cachedProfile = await cacheManager.getCachedProfile(user.uid);

			if (cachedProfile) {
				setFirstName((prev) => (prev !== cachedProfile.first_name ? cachedProfile.first_name || '' : prev));
				setLastName((prev) => (prev !== cachedProfile.last_name ? cachedProfile.last_name || '' : prev));

				if (profilePhotoRef.current !== cachedProfile.photo_url) {
					profilePhotoRef.current = cachedProfile.photo_url;
				}
			} else {
				const profile = await getUserProfile(user.uid);
				if (profile) {
					setFirstName(profile.first_name || '');
					setLastName(profile.last_name || '');
					profilePhotoRef.current = profile.photo_url;
					await cacheManager.saveProfile(user.uid, profile);
				}
			}
		} catch (error) {
			console.error('Error loading profile:', error);
		}
	}, [user.uid]);

	useEffect(() => {
		loadUserProfile();
	}, [loadUserProfile]);

	const handleProfilePhotoUpload = async () => {
		try {
			await ImagePickerComponent(async (croppedImagePath) => {
				const photoUrl = await uploadProfilePhoto(user.uid, croppedImagePath);
				if (photoUrl) {
					profilePhotoRef.current = photoUrl;
					await updateUserProfile(user.uid, { photo_url: photoUrl });

					const updatedProfile = { first_name: firstName, last_name: lastName, photo_url: photoUrl };
					await cacheManager.saveProfile(user.uid, updatedProfile);
				} else {
					throw new Error('Failed to get download URL');
				}
			});
		} catch (error) {
			console.error('Error uploading photo:', error);
			Alert.alert('Error', 'Failed to upload photo');
		}
	};

	const handleSaveProfile = async () => {
		try {
			await updateUserProfile(user.uid, {
				first_name: firstName.trim(),
				last_name: lastName.trim(),
			});

			await cacheManager.saveProfile(user.uid, {
				first_name: firstName.trim(),
				last_name: lastName.trim(),
				photo_url: profilePhotoRef.current,
			});

			setHasChanges(false);
			Alert.alert('Success', 'Profile updated successfully');
		} catch (error) {
			console.error('Error updating profile:', error);
			Alert.alert('Error', 'Failed to update profile');
		}
	};

	const handleTextChange = (text, field) => {
		if (field === 'firstName') {
			setFirstName(text);
		} else {
			setLastName(text);
		}
		setHasChanges(true);
	};

	return (
		<View style={styles.container}>
			<View style={styles.headerSettingsPages}>
				<TouchableOpacity style={styles.settingItemLeft} onPress={() => navigation.goBack()}>
					<Icon name="chevron-back" size={24} color={colors.text.primary} />
					<Text style={styles.profileName}>Profile</Text>
				</TouchableOpacity>
			</View>

			<ScrollView
				style={styles.settingsList}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="interactive"
				automaticallyAdjustKeyboardInsets={true}
			>
				<View style={styles.profileImageSection}>
					<View style={styles.profileImageContainer}>
						{profilePhotoRef.current ? (
							<Image
								source={{ uri: profilePhotoRef.current }}
								style={styles.profileImage}
								contentFit="cover"
								cachePolicy="memory-disk"
							/>
						) : (
							<View style={styles.defaultAvatarContainer}>
								<Icon name="person-circle-outline" size={120} color={colors.text.secondary} />
							</View>
						)}
						<TouchableOpacity style={styles.editImageButton} onPress={handleProfilePhotoUpload}>
							<Icon name="camera-outline" size={20} color={colors.background.primary} />
						</TouchableOpacity>
					</View>
				</View>

				{/* Card Section for First Name, Last Name, and Save Changes */}
				<View
					style={{
						backgroundColor: colors.background.secondary,
						padding: spacing.md,
						marginHorizontal: spacing.md,
						marginBottom: spacing.lg,
						borderRadius: layout.borderRadius.md,
					}}
				>
					<View style={styles.formSection}>
						<View style={styles.inputGroup}>
							<Text style={styles.label}>First Name</Text>
							<TextInput
								style={[
									styles.input,
									styles.inputText,
									{
										borderWidth: 1,
										borderColor: colors.border,
										borderRadius: layout.borderRadius.sm,
										padding: spacing.sm,
									},
								]}
								value={firstName}
								onChangeText={(text) => handleTextChange(text, 'firstName')}
								placeholder="Enter first name"
								placeholderTextColor={colors.text.secondary}
								returnKeyType="next"
								onSubmitEditing={() => {
									lastNameInputRef.current.focus();
								}}
								blurOnSubmit={false}
								autoCorrect={false}
								autoCapitalize="none"
							/>
						</View>

						<View style={styles.inputGroup}>
							<Text style={styles.label}>Last Name</Text>
							<TextInput
								ref={lastNameInputRef}
								style={[
									styles.input,
									styles.inputText,
									{
										borderWidth: 1,
										borderColor: colors.border,
										borderRadius: layout.borderRadius.sm,
										padding: spacing.sm,
									},
								]}
								value={lastName}
								onChangeText={(text) => handleTextChange(text, 'lastName')}
								placeholder="Enter last name"
								placeholderTextColor={colors.text.secondary}
								returnKeyType="done"
								onSubmitEditing={handleSaveProfile}
								autoCorrect={false}
								autoCapitalize="none"
							/>
						</View>

						<View style={{ alignItems: 'center' }}>
							<TouchableOpacity
								style={[
									styles.saveButton,
									!hasChanges && styles.saveButtonDisabled,
									{ width: 'auto', minWidth: 200 },
								]}
								onPress={handleSaveProfile}
								disabled={!hasChanges}
							>
								<Text style={styles.saveButtonText}>Save Changes</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>

				<View style={styles.logoutContainer}>
					<TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
						<Icon name="log-out-outline" size={24} color={colors.danger} />
						<Text style={styles.logoutText}>Log Out</Text>
					</TouchableOpacity>
				</View>
			</ScrollView>
		</View>
	);
};

export default ProfileScreen;
