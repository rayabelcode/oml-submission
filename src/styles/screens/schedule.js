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
		section: {
			paddingHorizontal: spacing.lg,
			marginBottom: spacing.xl,
			flex: 1,
		},
		groupsContainer: {
			flex: 1,
		},
		contactGroup: {
			marginBottom: spacing.sm,
		},
		groupHeader: {
			paddingTop: spacing.md,
			paddingBottom: spacing.xs,
			borderBottomWidth: .5,
			borderBottomColor: colors.border,
			marginBottom: spacing.md,
		},
		groupTitle: {
			fontSize: 22,
			fontWeight: '700',
			color: colors.text.primary,
		},
		contactList: {
			flex: 1,
		},
		contactCard: {
			backgroundColor: colors.background.secondary,
			borderRadius: layout.borderRadius.md,
			marginBottom: spacing.md,
			padding: spacing.md,
			borderWidth: 1,
			borderColor: colors.border,
		},
		contactCardHeader: {
			flexDirection: 'row',
			alignItems: 'center',
			marginBottom: spacing.xxs,
		},
		avatarContainer: {
			marginRight: spacing.md,
		},
		avatar: {
			width: 60,
			height: 60,
			borderRadius: 30,
		},
		defaultAvatar: {
			width: 60,
			height: 60,
			borderRadius: 30,
			backgroundColor: colors.primary,
			justifyContent: 'center',
			alignItems: 'center',
		},
		contactInfo: {
			flex: 1,
		},
		contactName: {
			fontSize: 18,
			fontWeight: '700',
			color: colors.text.primary,
			marginBottom: spacing.xxs,
		},
		reminderType: {
			fontSize: 15,
			fontWeight: '700',
			color: colors.text.secondary,
			opacity: 0.9,
		},
		contactCardFooter: {
			flexDirection: 'row',
			justifyContent: 'flex-end',
			alignItems: 'center',
			marginTop: spacing.xxs,
		},
		dateContainer: {
			flexDirection: 'row',
			alignItems: 'center',
			backgroundColor: colors.background.tertiary,
			paddingHorizontal: spacing.md,
			paddingVertical: spacing.xs,
			borderRadius: layout.borderRadius.md,
		},
		dateIcon: {
			marginRight: spacing.sm,
		},
		contactDate: {
			fontSize: 14,
			fontWeight: '600',
			color: colors.text.primary,
			opacity: 0.9,
		},
		// Empty state styling
		emptyStateContainer: {
			flex: 1,
			justifyContent: 'center',
			alignItems: 'center',
			paddingHorizontal: spacing.xl,
			paddingVertical: spacing.xxl,
		},
		emptyStateIcon: {
			marginBottom: spacing.lg,
			opacity: 0.6,
		},
		emptyStateTitle: {
			fontSize: 20,
			fontWeight: '600',
			color: colors.text.primary,
			marginBottom: spacing.md,
			textAlign: 'center',
		},
		emptyStateMessage: {
			fontSize: 16,
			color: colors.text.secondary,
			textAlign: 'center',
			marginBottom: spacing.xl,
			lineHeight: 22,
		},
		emptyStateButton: {
			minWidth: 150,
		},
		// Loading state styling
		loadingContainer: {
			flex: 1,
			justifyContent: 'center',
			alignItems: 'center',
			paddingVertical: spacing.xxl,
		},
		loadingText: {
			fontSize: 16,
			color: colors.text.secondary,
			marginTop: spacing.md,
		},
	});
};

export { useStyles };
