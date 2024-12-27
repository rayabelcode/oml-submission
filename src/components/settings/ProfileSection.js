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
	const [displayName, setDisplayName] = useState('');

	useEffect(() => {
		updateDisplayName();
	}, [userProfile]);

	const updateDisplayName = () => {
		if (userProfile?.first_name && userProfile?.last_name) {
			setDisplayName(`${userProfile.first_name} ${userProfile.last_name}`);
		} else {
			setDisplayName(user?.email || 'Set up your profile');
		}
	};

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
					<Text style={[styles.profileName, { flexShrink: 1 }]} numberOfLines={1} adjustsFontSizeToFit>
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
