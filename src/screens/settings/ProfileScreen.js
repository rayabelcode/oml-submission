import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
	View,
	Text,
	Image,
	TouchableOpacity,
	ScrollView,
	TextInput,
	Alert,
	ActivityIndicator,
} from 'react-native';
import { useStyles } from '../../styles/screens/settings';
import { useTheme } from '../../context/ThemeContext';
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
	const { colors, spacing, layout } = useTheme();
	const { user, signOut } = useAuth();
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const profilePhotoRef = useRef(null);
	const [hasChanges, setHasChanges] = useState(false);
	const lastNameInputRef = useRef(null);
	const [loggingOut, setLoggingOut] = useState(false);

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
							// Set loading state
							setLoggingOut(true);

							// Clean up all subscriptions before signing out
							await Promise.resolve(cleanupSubscriptions());

							// Small delay to make sure cleanup completes
							await new Promise((resolve) => setTimeout(resolve, 800));

							const { error } = await signOut();
							if (error) throw error;
						} catch (error) {
							setLoggingOut(false);
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
			{/* Loading overlay for logout */}
			{loggingOut && (
				<View style={styles.loadingOverlay}>
					<ActivityIndicator size="large" color={colors.primary} />
					<Text style={styles.loadingText}>Logging Out...</Text>
				</View>
			)}

			{/* Header with back button and title */}
			<View style={styles.screenHeader}>
				<TouchableOpacity style={styles.headerBackButton} onPress={() => navigation.goBack()}>
					<Icon name="chevron-back" size={24} color={colors.text.primary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Profile Information</Text>
				<View style={styles.headerRightPlaceholder} />
			</View>

			<ScrollView
				style={styles.settingsList}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="interactive"
				automaticallyAdjustKeyboardInsets={true}
			>
				{/* Profile Photo Card */}
				<View style={[styles.settingsCard, styles.profilePhotoCard]}>
					<Text style={styles.cardTitleCenter}>Profile Photo</Text>
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
				</View>

				{/* Name Information Card */}
				<View style={styles.settingsCard}>
					<Text style={styles.cardTitleCenter}>Name</Text>

					<View style={styles.formGroup}>
						<Text style={styles.formLabel}>First Name</Text>
						<TextInput
							style={styles.formInput}
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
							autoCapitalize="words"
						/>
					</View>

					<View style={styles.formGroup}>
						<Text style={styles.formLabel}>Last Name</Text>
						<TextInput
							ref={lastNameInputRef}
							style={styles.formInput}
							value={lastName}
							onChangeText={(text) => handleTextChange(text, 'lastName')}
							placeholder="Enter last name"
							placeholderTextColor={colors.text.secondary}
							returnKeyType="done"
							onSubmitEditing={handleSaveProfile}
							autoCorrect={false}
							autoCapitalize="words"
						/>
					</View>

					<TouchableOpacity
						style={[styles.primaryButton, !hasChanges && styles.disabledButton]}
						onPress={handleSaveProfile}
						disabled={!hasChanges}
					>
						<Text style={styles.primaryButtonText}>Save Changes</Text>
					</TouchableOpacity>
				</View>

				{/* Logout Card */}
				<View style={styles.settingsCard}>
					<Text style={styles.cardTitleCenter}>Session</Text>
					<TouchableOpacity style={styles.dangerButton} onPress={handleLogout} disabled={loggingOut}>
						<Icon name="log-out" size={25} color={colors.background.primary} />
						<Text style={styles.dangerButtonText}>{loggingOut ? 'Logging Out...' : 'Log Out'}</Text>
					</TouchableOpacity>
				</View>
			</ScrollView>
		</View>
	);
};

export default ProfileScreen;
