import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useStyles } from '../../styles/screens/settings';
import Icon from 'react-native-vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useTheme } from '../../context/ThemeContext';

const ProfileSection = ({ userProfile, user, onProfilePress }) => {
	const styles = useStyles();
	const { colors } = useTheme();

	const displayName =
		userProfile?.first_name && userProfile?.last_name
			? `${userProfile.first_name} ${userProfile.last_name}`
			: user?.email || 'Set up your profile';

	return (
		<TouchableOpacity onPress={onProfilePress}>
			<View style={styles.profileSection}>
				<View style={styles.avatar}>
					{userProfile?.photo_url ? (
						<Image
							source={{ uri: userProfile.photo_url }}
							style={styles.avatarImage}
							contentFit="cover"
							cachePolicy="memory-disk"
						/>
					) : (
						<Icon name="person-circle-outline" size={60} color={colors.text.secondary} />
					)}
				</View>
				<View style={styles.profileInfo}>
					<Text style={styles.profileName} numberOfLines={1}>
						{displayName}
					</Text>
				</View>
				<Icon name="chevron-forward" size={24} color={colors.text.secondary} />
			</View>
		</TouchableOpacity>
	);
};

export default ProfileSection;
