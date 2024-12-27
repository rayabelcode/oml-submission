import React from 'react';
import { View, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import Constants from 'expo-constants';

const CallOptions = ({ onSelect, show, contact }) => {
	const { colors } = useTheme();

	if (!show) return null;

	const handleCall = async (callType) => {
		if (Constants.appOwnership === 'expo') {
			// In Expo Go, just use direct linking
			let urlScheme;
			switch (callType) {
				case 'facetime-video':
					urlScheme = `facetime://${contact.phone}`;
					break;
				case 'facetime-audio':
					urlScheme = `facetime-audio://${contact.phone}`;
					break;
				default:
					urlScheme = `tel:${contact.phone}`;
			}
			await Linking.openURL(urlScheme);
		} else {
			onSelect(callType);
		}
	};

	return (
		<View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
			<TouchableOpacity style={styles.option} onPress={() => handleCall('phone')}>
				<Icon name="call-outline" size={24} color={colors.primary} />
			</TouchableOpacity>
			<TouchableOpacity style={styles.option} onPress={() => handleCall('facetime-audio')}>
				<Icon name="mic-outline" size={24} color={colors.primary} />
			</TouchableOpacity>
			<TouchableOpacity style={styles.option} onPress={() => handleCall('facetime-video')}>
				<Icon name="videocam-outline" size={24} color={colors.primary} />
			</TouchableOpacity>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		position: 'absolute',
		right: 50,
		top: 50,
		borderRadius: 12,
		padding: 8,
		flexDirection: 'row',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 5,
	},
	option: {
		padding: 8,
		marginHorizontal: 4,
	},
});

export default CallOptions;
