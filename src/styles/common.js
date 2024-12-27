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
			padding: spacing.md,
			width: Platform.OS === 'web' ? '50%' : '90%',
			height: Platform.OS === 'web' ? 'auto' : '75%',
			maxHeight: Platform.OS === 'web' ? '90vh' : '75%',
			alignSelf: 'center',
			borderWidth: 2,
			borderColor: colors.border,
		},
		modalHeader: {
			flexDirection: 'row',
			justifyContent: 'center',
			alignItems: 'center',
			marginBottom: spacing.md,
			position: 'relative',
			paddingHorizontal: spacing.xl,
			minHeight: 40,
			paddingLeft: 40, // Match the width of the call button
			paddingRight: 40, // Match the width of the close button
		},
		modalTitle: {
			fontSize: 24,
			fontWeight: 'bold',
			textAlign: 'center',
			color: colors.text.primary,
			flex: 1,
			numberOfLines: 1,
			adjustsFontSizeToFit: true,
			maxHeight: 28,
			marginHorizontal: 0, // Remove horizontal margin
			paddingLeft: 0, // Remove left padding
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
