import React from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, Text, ActivityIndicator } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing, layout } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';

const ActionModal = ({ show, onClose, options, loading, error }) => {
	const { colors } = useTheme();

	if (!show) return null;

	return (
		<Modal visible={show} transparent={true} animationType="fade" onRequestClose={onClose}>
			<TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={loading ? null : onClose}>
				<View style={[styles.modalContent, { backgroundColor: colors.background.secondary }]}>
					{loading ? (
						<View style={styles.loadingContainer}>
							<ActivityIndicator size="large" color={colors.primary} />
							<Text style={[styles.loadingText, { color: colors.text.primary }]}>Processing...</Text>
						</View>
					) : error ? (
						<View style={styles.errorContainer}>
							<Icon name="alert-circle" size={40} color={colors.error} />
							<Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
							<TouchableOpacity style={styles.retryButton} onPress={onClose}>
								<Text style={[styles.retryText, { color: colors.primary }]}>Try Again</Text>
							</TouchableOpacity>
						</View>
					) : (
						options.map((option, index) => (
							<React.Fragment key={option.id}>
								<TouchableOpacity
									style={[styles.option, { marginVertical: spacing.md }]}
									onPress={option.onPress}
									disabled={option.disabled}
								>
									<View style={styles.iconContainer}>
										<Icon
											name={option.icon}
											size={40}
											color={option.disabled ? colors.text.disabled : colors.primary}
										/>
									</View>
									<Text
										style={[
											styles.optionText,
											{
												color: option.disabled ? colors.text.disabled : colors.text.primary,
											},
										]}
									>
										{option.text}
									</Text>
								</TouchableOpacity>
								{index < options.length - 1 && (
									<View style={[styles.divider, { backgroundColor: colors.border }]} />
								)}
							</React.Fragment>
						))
					)}
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
	loadingContainer: {
		padding: spacing.xl,
		alignItems: 'center',
	},
	loadingText: {
		marginTop: spacing.md,
		fontSize: 16,
		fontWeight: '500',
	},
	errorContainer: {
		padding: spacing.xl,
		alignItems: 'center',
	},
	errorText: {
		marginTop: spacing.md,
		fontSize: 16,
		fontWeight: '500',
		textAlign: 'center',
	},
	retryButton: {
		marginTop: spacing.lg,
		padding: spacing.md,
	},
	retryText: {
		fontSize: 16,
		fontWeight: '500',
	},
});

export default ActionModal;
