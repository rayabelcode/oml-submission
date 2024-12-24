import React, { useState, useEffect } from 'react';
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
	const [isEditing, setIsEditing] = useState(false);
	const [profilePhoto, setProfilePhoto] = useState(null);

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
				mediaTypes: ImagePicker.MediaTypeOptions.Images,
				allowsEditing: true,
				aspect: [1, 1],
				quality: 0.5,
			});

			if (!result.canceled && result.assets[0].uri) {
				const photoUrl = await uploadProfilePhoto(user.uid, result.assets[0].uri);
				if (photoUrl) {
					setProfilePhoto(photoUrl);
					await updateUserProfile(user.uid, { photo_url: photoUrl });
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
				first_name: firstName,
				last_name: lastName,
			});
			setIsEditing(false);
			Alert.alert('Success', 'Profile updated successfully');
		} catch (error) {
			console.error('Error updating profile:', error);
			Alert.alert('Error', 'Failed to update profile');
		}
	};

	return (
		<View style={styles.container}>
			<View style={styles.profileSection}>
				<TouchableOpacity style={styles.settingItemLeft} onPress={() => navigation.goBack()}>
					<Icon name="chevron-back" size={24} color={colors.text.primary} />
					<Text style={styles.profileName}>Profile</Text>
				</TouchableOpacity>
				{isEditing ? (
					<TouchableOpacity onPress={handleSaveProfile}>
						<Text style={[styles.settingText, { color: colors.primary }]}>Save</Text>
					</TouchableOpacity>
				) : (
					<TouchableOpacity onPress={() => setIsEditing(true)}>
						<Text style={[styles.settingText, { color: colors.primary }]}>Edit</Text>
					</TouchableOpacity>
				)}
			</View>

			<ScrollView style={styles.settingsList}>
				<View style={styles.profileImageSection}>
					<View style={styles.profileImageContainer}>
						{profilePhoto ? (
							<Image source={{ uri: profilePhoto }} style={styles.profileImage} contentFit="cover" />
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
						{isEditing ? (
							<TextInput
								style={[styles.input, styles.inputText]}
								value={firstName}
								onChangeText={setFirstName}
								placeholder="Enter first name"
								placeholderTextColor={colors.text.secondary}
							/>
						) : (
							<View style={styles.input}>
								<Text style={styles.inputText}>{firstName || 'Not set'}</Text>
							</View>
						)}
					</View>

					<View style={styles.inputGroup}>
						<Text style={styles.label}>Last Name</Text>
						{isEditing ? (
							<TextInput
								style={[styles.input, styles.inputText]}
								value={lastName}
								onChangeText={setLastName}
								placeholder="Enter last name"
								placeholderTextColor={colors.text.secondary}
							/>
						) : (
							<View style={styles.input}>
								<Text style={styles.inputText}>{lastName || 'Not set'}</Text>
							</View>
						)}
					</View>
				</View>
			</ScrollView>
		</View>
	);
};

export default ProfileScreen;
