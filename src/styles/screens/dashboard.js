// src/styles/screens/dashboard.js
import { StyleSheet, Platform } from 'react-native';
import { spacing, layout, useTheme } from '../../context/ThemeContext';

const useStyles = () => {
	const { colors } = useTheme();

	return StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: colors.background.primary,
			paddingTop: Platform.OS === 'ios' ? 50 : 0,
		},
		contactsList: {
			flex: 1,
			padding: spacing.md,
		},
		statsContainer: {
			flex: 1,
			padding: spacing.md,
		},
		header: {
			padding: spacing.md,
			alignItems: 'center',
		},
		title: {
			fontSize: 24,
			fontWeight: 'bold',
			textAlign: 'center',
			color: colors.text.primary,
		},
		buttonContainer: {
			flexDirection: 'row',
			paddingHorizontal: spacing.md,
			paddingTop: spacing.lg,
			paddingBottom: spacing.md,
			borderBottomWidth: 1,
			borderBottomColor: colors.border,
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
		toggleButtonActive: {
			backgroundColor: colors.background.tertiary,
		},
		card: {
			backgroundColor: colors.background.secondary,
			padding: spacing.md,
			borderRadius: layout.borderRadius.md,
			marginBottom: spacing.sm,
			borderWidth: 1,
			borderColor: colors.border,
		},
		cardHeader: {
			flexDirection: 'row',
			alignItems: 'center',
		},
		cardInfo: {
			flex: 1,
		},
		cardName: {
			fontSize: 16,
			fontWeight: '500',
			marginBottom: 4,
			color: colors.text.primary,
		},
		cardDate: {
			fontSize: 14,
			color: colors.text.secondary,
		},
		avatarContainer: {
			width: 40,
			height: 40,
			borderRadius: 20,
			backgroundColor: colors.background.tertiary,
			justifyContent: 'center',
			alignItems: 'center',
			marginRight: spacing.sm,
		},
		avatar: {
			width: 40,
			height: 40,
			borderRadius: 20,
		},
		statCard: {
			backgroundColor: colors.background.secondary,
			padding: spacing.md,
			borderRadius: layout.borderRadius.md,
			marginBottom: spacing.md,
			borderWidth: 1,
			borderColor: colors.border,
		},
		statTitle: {
			fontSize: 16,
			fontWeight: '600',
			color: colors.text.secondary,
			marginBottom: spacing.sm,
		},
		statValue: {
			fontSize: 36,
			fontWeight: 'bold',
			color: colors.primary,
			marginBottom: 5,
		},
		statLabel: {
			fontSize: 14,
			color: colors.text.secondary,
		},
		statListItem: {
			fontSize: 16,
			color: colors.text.primary,
			paddingVertical: spacing.sm,
			borderBottomWidth: 1,
			borderBottomColor: colors.border,
		},
		message: {
			textAlign: 'center',
			padding: spacing.md,
			color: colors.text.secondary,
			fontSize: 16,
		},
		congratsMessage: {
			fontSize: 16,
			color: colors.secondary,
			textAlign: 'left',
			paddingVertical: spacing.sm,
			fontStyle: 'italic',
			fontWeight: '600',
		},
		notificationsContainer: {
			flex: 1,
			padding: spacing.md,
			backgroundColor: colors.background.primary,
		},
		// Notification swiping
		swipeActionContainer: {
			justifyContent: 'center',
			alignItems: 'center',
			width: 100,
			height: '100%',
		},
		swipeActionText: {
			color: colors.background.primary,
			fontWeight: '600',
			fontSize: 16,
		},
	});
};

export { useStyles };
