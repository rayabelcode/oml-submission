import React from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing, layout } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';

const ActionModal = ({ show, onClose, options }) => {
	const { colors } = useTheme();

	if (!show) return null;

	return (
		<Modal visible={show} transparent={true} animationType="fade" onRequestClose={onClose}>
			<TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
				<View style={[styles.modalContent, { backgroundColor: colors.background.secondary }]}>
					{options.map((option, index) => (
						<React.Fragment key={option.id}>
							<TouchableOpacity
								style={[styles.option, { marginVertical: spacing.md }]}
								onPress={() => {
									onClose();
									option.onPress();
								}}
							>
								<View style={styles.iconContainer}>
									<Text>
										<Icon name={option.icon} size={40} color={colors.primary} />
									</Text>
								</View>
								<Text style={[styles.optionText, { color: colors.text.primary }]}>{option.text}</Text>
							</TouchableOpacity>
							{index < options.length - 1 && (
								<View style={[styles.divider, { backgroundColor: colors.border }]} />
							)}
						</React.Fragment>
					))}
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

export default ActionModal;
