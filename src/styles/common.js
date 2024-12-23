// src/styles/common.js
import { StyleSheet, Platform } from 'react-native';
import { spacing, layout, useTheme } from '../context/ThemeContext';

export const useCommonStyles = () => {
	const { colors } = useTheme();

	return StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: colors.background.primary,
			paddingTop: Platform.OS === 'ios' ? 50 : 0,
		},
		content: {
			flex: 1,
		},
		card: {
			backgroundColor: colors.background.secondary,
			padding: spacing.md,
			borderRadius: layout.borderRadius.md,
			marginBottom: spacing.sm,
			borderWidth: 1,
			borderColor: colors.border,
		},
		modalContainer: {
			flex: 1,
			backgroundColor: colors.background.overlay,
			justifyContent: 'center',
			alignItems: 'center',
			width: '100%',
		},
		modalContent: {
			backgroundColor: colors.background.primary,
			borderRadius: layout.borderRadius.lg,
			padding: spacing.xs,
			width: Platform.OS === 'web' ? '50%' : '88%',
			alignSelf: 'center',
			maxHeight: Platform.OS === 'ios' ? '75%' : '90%',
			borderWidth: 2,
			borderColor: colors.border,
			...(Platform.OS === 'ios'
				? {
					height: '75%',
				}
				: {}),
		},

		modalHeader: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'center',
			marginBottom: spacing.md,
			position: 'relative',
			paddingHorizontal: spacing.md,
		},
		modalTitle: {
			fontSize: 24,
			fontWeight: 'bold',
			textAlign: 'center',
			color: colors.text.primary,
		},
		primaryButton: {
			backgroundColor: colors.primary,
			paddingVertical: spacing.sm,
			paddingHorizontal: spacing.md,
			borderRadius: layout.borderRadius.md,
			alignItems: 'center',
			justifyContent: 'center',
			flexDirection: 'row',
		},
		primaryButtonText: {
			color: colors.background.primary,
			fontSize: 16,
			fontWeight: '500',
		},
		secondaryButton: {
			backgroundColor: colors.background.primary,
			borderWidth: 1,
			borderColor: colors.primary,
			paddingVertical: spacing.sm,
			paddingHorizontal: spacing.md,
			borderRadius: layout.borderRadius.md,
			alignItems: 'center',
			justifyContent: 'center',
			flexDirection: 'row',
		},
		secondaryButtonText: {
			color: colors.primary,
			fontSize: 16,
			fontWeight: '500',
		},
		toggleButton: {
			flex: 1,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			padding: spacing.sm,
			backgroundColor: colors.background.secondary,
			margin: 5,
			borderRadius: layout.borderRadius.md,
			borderWidth: 1,
			borderColor: colors.primary,
		},
		toggleButtonText: {
			marginLeft: spacing.sm,
			fontSize: 16,
			color: colors.primary,
			fontWeight: '500',
		},
		input: {
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: layout.borderRadius.md,
			padding: spacing.md,
			fontSize: 16,
			color: colors.text.primary,
			backgroundColor: colors.background.primary,
		},
		inputContainer: {
			flexDirection: 'row',
			alignItems: 'center',
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: layout.borderRadius.md,
			paddingHorizontal: spacing.md,
			marginBottom: spacing.md,
		},
		message: {
			textAlign: 'center',
			padding: spacing.md,
			color: colors.text.secondary,
			fontSize: 16,
		},
		loadingOverlay: {
			position: 'absolute',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			backgroundColor: colors.background.overlay,
			justifyContent: 'center',
			alignItems: 'center',
		},
		section: {
			padding: spacing.md,
			borderBottomWidth: 1,
			borderBottomColor: colors.border,
		},
		sectionTitle: {
			fontSize: 16,
			fontWeight: '500',
			marginBottom: spacing.sm,
			color: colors.text.secondary,
		},
		avatar: {
			width: 60,
			height: 60,
			borderRadius: 30,
			backgroundColor: colors.background.secondary,
			justifyContent: 'center',
			alignItems: 'center',
		},
		avatarImage: {
			width: '100%',
			height: '100%',
			borderRadius: 30,
		},
	});
};
