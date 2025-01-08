import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { useStyles } from '../../styles/screens/settings';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import ImagePickerComponent from '../../components/general/ImagePicker';
import { useAuth } from '../../context/AuthContext';
import { getUserProfile, updateUserProfile, uploadProfilePhoto } from '../../utils/firestore';
import { cacheManager } from '../../utils/cache';

const ProfileScreen = ({ navigation }) => {
	const styles = useStyles();
	const { colors } = useTheme();
	const { user } = useAuth();
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const profilePhotoRef = useRef(null); // Ref for profile photo to avoid re-renders
	const [hasChanges, setHasChanges] = useState(false);
	const lastNameInputRef = useRef(null);

	// Fetch and load user profile
	const loadUserProfile = useCallback(async () => {
		try {
			const cachedProfile = await cacheManager.getCachedProfile(user.uid);

			if (cachedProfile) {
				// Use cached profile data if available
				setFirstName((prev) => (prev !== cachedProfile.first_name ? cachedProfile.first_name || '' : prev));
				setLastName((prev) => (prev !== cachedProfile.last_name ? cachedProfile.last_name || '' : prev));

				if (profilePhotoRef.current !== cachedProfile.photo_url) {
					profilePhotoRef.current = cachedProfile.photo_url;
				}
			} else {
				// Fetch from the backend if the cache is invalid or missing
				const profile = await getUserProfile(user.uid);
				if (profile) {
					setFirstName(profile.first_name || '');
					setLastName(profile.last_name || '');
					profilePhotoRef.current = profile.photo_url;

					// Save the fetched profile data to the cache
					await cacheManager.saveProfile(user.uid, profile);
				}
			}
		} catch (error) {
			console.error('Error loading profile:', error);
		}
	}, [user.uid]);

	// Load profile once on component mount
	useEffect(() => {
		loadUserProfile();
	}, [loadUserProfile]);

	// Handle photo upload
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

	// Handle saving profile changes
	const handleSaveProfile = async () => {
		try {
			await updateUserProfile(user.uid, {
				first_name: firstName.trim(),
				last_name: lastName.trim(),
			});

			// Update the cached profile
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

	// Handle text input changes
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

				<View style={styles.formSection}>
					<View style={styles.inputGroup}>
						<Text style={styles.label}>First Name</Text>
						<TextInput
							style={[styles.input, styles.inputText]}
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
							style={[styles.input, styles.inputText]}
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
			</ScrollView>
		</View>
	);
};

export default ProfileScreen;
