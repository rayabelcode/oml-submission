import { StyleSheet, Platform } from 'react-native';
import { spacing, layout } from '../theme';
import { useTheme } from '../../context/ThemeContext';

const createStyles = (colors) =>
	StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: colors.background.primary,
			paddingTop: Platform.OS === 'ios' ? 50 : 0,
		},
		settingsList: {
			flex: 1,
			backgroundColor: colors.background.primary,
		},
		profileSection: {
			flexDirection: 'row',
			padding: spacing.md,
			backgroundColor: colors.background.secondary,
			alignItems: 'center',
		},
		profileInfo: {
			marginLeft: spacing.md,
		},
		profileName: {
			fontSize: 18,
			fontWeight: 'bold',
			color: colors.text.primary,
		},
		profileEmail: {
			color: colors.text.secondary,
		},
		avatar: {
			width: 60,
			height: 60,
			borderRadius: 30,
			backgroundColor: colors.background.secondary,
			justifyContent: 'center',
			alignItems: 'center',
			position: 'relative',
		},
		avatarImage: {
			width: '100%',
			height: '100%',
			borderRadius: 30,
		},
		editOverlay: {
			position: 'absolute',
			bottom: -5,
			right: -5,
			backgroundColor: colors.primary,
			borderRadius: 12,
			padding: 5,
		},
		settingSection: {
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
		settingItem: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			paddingVertical: spacing.sm,
		},
		settingItemLeft: {
			flexDirection: 'row',
			alignItems: 'center',
		},
		settingText: {
			marginLeft: spacing.md,
			fontSize: 16,
			color: colors.text.primary,
		},
		loginContainer: {
			flex: 1,
			padding: spacing.md,
			justifyContent: 'center',
			backgroundColor: colors.background.primary,
		},
		loginTitle: {
			fontSize: 24,
			fontWeight: 'bold',
			marginBottom: 30,
			textAlign: 'center',
			color: colors.text.primary,
		},
		inputContainer: {
			flexDirection: 'row',
			alignItems: 'center',
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: layout.borderRadius.md,
			paddingHorizontal: spacing.md,
			marginBottom: spacing.md,
			backgroundColor: colors.background.secondary,
		},
		input: {
			flex: 1,
			padding: spacing.md,
			marginLeft: spacing.sm,
			fontSize: 16,
			color: colors.text.primary,
		},
		loginButton: {
			backgroundColor: colors.primary,
			padding: spacing.md,
			borderRadius: layout.borderRadius.md,
			marginTop: spacing.md,
		},
		loginButtonText: {
			color: colors.background.primary,
			textAlign: 'center',
			fontSize: 16,
			fontWeight: '500',
		},
		logoutButton: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			padding: spacing.md,
			margin: spacing.md,
			backgroundColor: colors.background.primary,
			borderRadius: layout.borderRadius.md,
			borderWidth: 1,
			borderColor: colors.danger,
		},
		logoutText: {
			color: colors.danger,
			marginLeft: spacing.sm,
			fontSize: 16,
			fontWeight: '500',
		},
		switchButton: {
			marginTop: spacing.md,
			padding: spacing.sm,
		},
		switchButtonText: {
			color: colors.primary,
			textAlign: 'center',
			fontSize: 14,
		},
		modalContainer: {
			flex: 1,
			backgroundColor: colors.background.overlay,
			justifyContent: 'center',
			padding: spacing.md,
		},
		modalContent: {
			backgroundColor: colors.background.primary,
			borderRadius: layout.borderRadius.lg,
			padding: spacing.md,
		},
		modalHeader: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'center',
			marginBottom: spacing.md,
		},
		modalTitle: {
			fontSize: 20,
			fontWeight: 'bold',
			color: colors.text.primary,
		},
		privacyOption: {
			flexDirection: 'row',
			alignItems: 'center',
			paddingVertical: spacing.md,
			borderBottomWidth: 1,
			borderBottomColor: colors.border,
		},
		privacyOptionText: {
			marginLeft: spacing.md,
			fontSize: 16,
			color: colors.primary,
		},
		deleteOption: {
			borderBottomWidth: 0,
		},
		deleteText: {
			color: colors.danger,
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
	});

export const useStyles = () => {
	const { colors } = useTheme();
	return createStyles(colors);
};
