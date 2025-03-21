import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useStyles } from '../../styles/screens/settings';
import Icon from 'react-native-vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useTheme } from '../../context/ThemeContext';
import FormattedPhoneNumber from '../general/FormattedPhoneNumber';

const ProfileSection = ({ userProfile, user }) => {
	const styles = useStyles();
	const { colors } = useTheme();

	// Calculate display name directly in render for immediate update
	const displayName =
		userProfile?.first_name && userProfile?.last_name
			? `${userProfile.first_name} ${userProfile.last_name}`
			: user?.email || 'Set up your profile';

	return (
		<View style={styles.profileBackground}>
			<View style={[styles.profileSection, { marginTop: 20, marginBottom: 20 }]}>
				<View style={styles.profileContent}>
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
					<Text style={styles.profileName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
						{displayName}
					</Text>
					{userProfile?.phone && (
						<FormattedPhoneNumber phoneNumber={userProfile.phone} style={styles.profileDetail} />
					)}
				</View>
			</View>
		</View>
	);
};

export default ProfileSection;
