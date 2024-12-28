import React from 'react';
import { View, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import Constants from 'expo-constants';

const CallOptions = ({ show, contact }) => {
	const { colors } = useTheme();

	if (!show) return null;

	const handleCall = async (callType) => {
		// Check if we're in Expo Go
		if (Constants.appOwnership === 'expo') {
			console.log('Call simulation in Expo Go:', callType, contact.phone);
			return; // Just log the attempt when in Expo Go
		}

		// Only proceed with actual calls on iOS
		if (Platform.OS === 'ios') {
			let urlScheme;
			switch (callType) {
				case 'facetime-video':
					urlScheme = `facetime://${contact.phone}`;
					break;
				case 'phone':
					urlScheme = `tel:${contact.phone}`;
					break;
				default:
					urlScheme = `tel:${contact.phone}`;
			}

			try {
				const supported = await Linking.canOpenURL(urlScheme);
				if (supported) {
					await Linking.openURL(urlScheme);
				}
			} catch (error) {
				console.error('Error initiating call:', error);
			}
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
		flex: 1,
		alignItems: 'center',
	},
});

export default CallOptions;
