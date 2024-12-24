import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { useStyles } from '../../styles/screens/settings';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useAuth } from '../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { getUserProfile, updateUserProfile, uploadProfilePhoto } from '../../utils/firestore';

const ProfileScreen = ({ navigation }) => {
	const styles = useStyles();
	const { colors } = useTheme();
	const { user } = useAuth();
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [profilePhoto, setProfilePhoto] = useState(null);
	const [hasChanges, setHasChanges] = useState(false);
	const lastNameInputRef = useRef(null);

	useEffect(() => {
		loadUserProfile();
	}, []);

	const loadUserProfile = async () => {
		try {
			const profile = await getUserProfile(user.uid);
			if (profile) {
				setFirstName(profile.first_name || '');
				setLastName(profile.last_name || '');
				setProfilePhoto(profile.photo_url);
			}
		} catch (error) {
			console.error('Error loading profile:', error);
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
				allowsEditing: true,
				aspect: [1, 1],
				quality: 0.5,
			});

			if (!result.canceled && result.assets && result.assets[0]) {
				const photoUrl = await uploadProfilePhoto(user.uid, result.assets[0].uri);
				if (photoUrl) {
					setProfilePhoto(photoUrl);
					await updateUserProfile(user.uid, { photo_url: photoUrl });
				} else {
					throw new Error('Failed to get download URL');
				}
			}
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
			<View style={styles.profileSection}>
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
						{profilePhoto ? (
							<Image
								source={{ uri: profilePhoto }}
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
