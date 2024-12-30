import React from 'react';
import { View, TouchableOpacity, StyleSheet, Linking, Platform, Text, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, layout } from '../../context/ThemeContext';
import Constants from 'expo-constants';

const CallOptions = ({ show, contact, onClose }) => {
	const { colors } = useTheme();

	if (!show) return null;

	const handleCall = async (callType) => {
		if (Constants.appOwnership === 'expo') {
			console.log('Call simulation in Expo Go:', callType, contact.phone);
			onClose();
			return;
		}

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
					onClose();
					await Linking.openURL(urlScheme);
				}
			} catch (error) {
				console.error('Error initiating call:', error);
				onClose();
			}
		}
	};

	return (
		<Modal visible={show} transparent={true} animationType="fade" onRequestClose={onClose}>
			<TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
				<View style={[styles.modalContent, { backgroundColor: colors.background.secondary }]}>
					<TouchableOpacity
						style={[styles.option, { marginBottom: spacing.md }]}
						onPress={() => handleCall('phone')}
					>
						<View style={styles.iconContainer}>
							<Text>
								<Icon name="call-outline" size={40} color={colors.primary} />
							</Text>
						</View>
						<Text style={[styles.optionText, { color: colors.text.primary }]}>Call {contact.first_name}</Text>
					</TouchableOpacity>

					<View style={[styles.divider, { backgroundColor: colors.border }]} />

					<TouchableOpacity
						style={[styles.option, { marginTop: spacing.md }]}
						onPress={() => handleCall('facetime-video')}
					>
						<View style={styles.iconContainer}>
							<Text>
								<Icon name="videocam-outline" size={40} color={colors.primary} />
							</Text>
						</View>
						<Text style={[styles.optionText, { color: colors.text.primary }]}>
							FaceTime {contact.first_name}
						</Text>
					</TouchableOpacity>
				</View>
			</TouchableOpacity>
		</Modal>
	);
};

const styles = StyleSheet.create({
	modalOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	modalContent: {
		width: '80%',
		borderRadius: layout.borderRadius.lg,
		padding: spacing.md,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 5,
	},
	option: {
		padding: spacing.md,
		alignItems: 'center',
	},
	iconContainer: {
		marginBottom: spacing.sm,
	},
	optionText: {
		fontSize: 16,
		fontWeight: '500',
	},
	divider: {
		height: 1,
		width: '100%',
	},
});

export default CallOptions;
