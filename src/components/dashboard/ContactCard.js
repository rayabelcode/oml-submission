import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import PropTypes from 'prop-types';
import Icon from 'react-native-vector-icons/Ionicons';
import { Image as ExpoImage } from 'expo-image';
import { useStyles } from '../../styles/screens/dashboard';
import { useCommonStyles } from '../../styles/common';
import { useTheme } from '../../context/ThemeContext';

const ContactCard = ({ contact, onPress, showProfilePhotos = true }) => {
	const { colors } = useTheme();
	const styles = useStyles();
	const commonStyles = useCommonStyles();

	const renderAvatar = () => {
		if (!showProfilePhotos) {
			return <Icon name="person-outline" size={24} color={colors.primary} />;
		}

		return contact.photo_url ? (
			<ExpoImage
				source={{ uri: contact.photo_url }}
				style={styles.avatar}
				cachePolicy="memory-disk"
				transition={200}
			/>
		) : (
			<Icon name="person-outline" size={24} color={colors.primary} />
		);
	};

	return (
		<TouchableOpacity style={commonStyles.card} onPress={() => onPress(contact)}>
			<View style={styles.cardHeader}>
				<View style={styles.avatarContainer}>{renderAvatar()}</View>
				<View style={styles.cardInfo}>
					<Text style={styles.cardName}>{`${contact.first_name} ${contact.last_name || ''}`}</Text>
					<Text style={styles.cardDate}>
						Next Contact: {new Date(contact.next_contact).toLocaleDateString()}
					</Text>
				</View>
				<Icon name="time-outline" size={16} color={colors.text.secondary} />
			</View>
		</TouchableOpacity>
	);
};

ContactCard.propTypes = {
	contact: PropTypes.shape({
		id: PropTypes.string.isRequired,
		first_name: PropTypes.string.isRequired,
		last_name: PropTypes.string,
		photo_url: PropTypes.string,
		next_contact: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]).isRequired,
	}).isRequired,
	onPress: PropTypes.func.isRequired,
	showProfilePhotos: PropTypes.bool,
};

export default ContactCard;
