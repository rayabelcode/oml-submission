import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../styles/theme';
import styles from '../../styles/screens/settings';

const ProfileSection = ({ userProfile, user, handleProfilePhotoUpload }) => (
	<View style={styles.profileSection}>
		<TouchableOpacity style={styles.avatar} onPress={handleProfilePhotoUpload}>
			{userProfile?.photo_url ? (
				<ExpoImage
					source={{ uri: userProfile.photo_url }}
					style={styles.avatarImage}
					cachePolicy="memory-disk"
				/>
			) : (
				<>
					<Icon name="person-outline" size={40} color={colors.primary} />
					<View style={styles.editOverlay}>
						<Icon name="camera-outline" size={20} color={colors.background.primary} />
					</View>
				</>
			)}
		</TouchableOpacity>

		<View style={styles.profileInfo}>
			<Text style={styles.profileEmail}>Account Info</Text>
			<Text style={styles.profileName}>{user.email}</Text>
		</View>
	</View>
);

export default ProfileSection;
