import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Icon from 'react-native-vector-icons/Ionicons';
import { useStyles } from '../../styles/screens/settings';
import { useTheme } from '../../context/ThemeContext';

const ProfileSection = ({ userProfile, user, handleProfilePhotoUpload }) => {
	const styles = useStyles();
	const { colors } = useTheme();

	return (
		<View style={styles.profileSection}>
			<TouchableOpacity style={styles.avatar} onPress={handleProfilePhotoUpload}>
				{userProfile?.photo_url ? (
					<ExpoImage
						source={{ uri: userProfile.photo_url }}
						style={styles.avatarImage}
						cachePolicy="memory-disk"
					/>
				) : (
					<Icon name="person-circle-outline" size={60} color={colors.primary} />
				)}
			</TouchableOpacity>

			<Text style={styles.profileName}>{user.email}</Text>
		</View>
	);
};

export default ProfileSection;
