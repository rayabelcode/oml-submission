import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
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
		<View style={[styles.optionsContainer, { backgroundColor: colors.background.secondary }]}>
			<TouchableOpacity style={styles.option} onPress={() => handleCall('phone')}>
				<Icon name="call-outline" size={24} color={colors.primary} />
			</TouchableOpacity>
			<TouchableOpacity style={styles.option} onPress={() => handleCall('facetime-video')}>
				<Icon name="videocam-outline" size={24} color={colors.primary} />
			</TouchableOpacity>
		</View>
	);
};

const styles = StyleSheet.create({
	optionsContainer: {
		position: 'absolute',
		top: '100%',
		left: 0,
		borderRadius: 8,
		paddingVertical: 4,
		paddingHorizontal: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 5,
		zIndex: 9999,
		flexDirection: 'row',
		minWidth: 120,
	},
	option: {
		padding: 8,
		marginHorizontal: 4,
		flex: 1, // Make options take equal space
		alignItems: 'center', // Center the icons
	},
});

export default CallOptions;
