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
			padding: spacing.sm,
			alignItems: 'center',
			borderBottomWidth: 1,
			borderBottomColor: colors.border,
		},
		headerContent: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'center',
			width: '100%',
			paddingRight: spacing.sm,
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
			marginBottom: spacing.sm,
			marginHorizontal: spacing.sm,
			borderRadius: layout.borderRadius.md,
			overflow: 'hidden',
		},
		cardContent: {
			width: '100%',
			padding: spacing.md,
			alignItems: 'center',
			backgroundColor: 'transparent',
			borderLeftWidth: 2,
			borderRightWidth: 2,
		},
		cardActions: {
			flexDirection: 'row',
			justifyContent: 'space-evenly',
			padding: spacing.md,
			backgroundColor: 'transparent',
		},
		actionButton: {
			flexDirection: 'row',
			alignItems: 'center',
			paddingVertical: spacing.xs,
			paddingHorizontal: spacing.sm,
			backgroundColor: 'transparent',
		},
		actionText: {
			marginLeft: spacing.xs,
			fontSize: 14,
			fontWeight: '500',
		},
		actionButtonSeparator: {
			width: 1,
			backgroundColor: colors.border,
		},
		cardHeader: {
			width: '100%',
			alignItems: 'center',
		},
		cardInfo: {
			flex: 1,
		},
		cardIcon: {
			marginRight: spacing.sm,
		},
		contactName: {
			fontSize: 16,
			color: colors.text.primary,
			marginBottom: spacing.xs,
			textAlign: 'center',
		},
		cardTop: {
			padding: spacing.md,
			alignItems: 'center',
		},
		titleRow: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			marginBottom: spacing.sm,
		},
		titleIcon: {
			marginRight: spacing.sm,
		},
		reminderTitle: {
			fontSize: 18,
			fontWeight: 'bold',
			color: colors.text.primary,
			textAlign: 'center',
		},
		reminderDescription: {
			fontSize: 14,
			color: colors.text.secondary,
			textAlign: 'center',
		},
		reminderDescription: {
			fontSize: 14,
			color: colors.text.secondary,
		},
		emptyStateContainer: {
			alignItems: 'center',
			justifyContent: 'center',
			paddingVertical: spacing.md,
			backgroundColor: colors.background.secondary,
			marginHorizontal: spacing.md,
			borderRadius: layout.borderRadius.md,
		},
		congratsMessage: {
			fontSize: 16,
			color: colors.secondary,
			textAlign: 'center',
			marginTop: spacing.md,
			fontWeight: '600',
		},
		cardName: {
			fontSize: 16,
			fontWeight: '500',
			marginBottom: 4,
			color: colors.text.primary,
		},
		cardDate: {
			fontSize: 16,
			color: colors.text.secondary,
			marginBottom: 10,
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
		headerRow: {
			paddingTop: spacing.md,
			paddingBottom: spacing.sm,
			borderTopLeftRadius: layout.borderRadius.md,
			borderTopRightRadius: layout.borderRadius.md,
			alignItems: 'center',
		},
		cardBody: {
			padding: spacing.md,
			backgroundColor: colors.background.secondary,
		},
		// Upcoming Calls
		avatarContainer: {
			width: 40,
			height: 40,
			borderRadius: 20,
			backgroundColor: colors.background.tertiary,
			justifyContent: 'center',
			alignItems: 'center',
		},
		avatar: {
			width: 40,
			height: 40,
			borderRadius: 20,
		},
		contactRow: {
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			width: '100%',
		},
		upcomingGrid: {
			flexDirection: 'row',
			flexWrap: 'wrap',
			justifyContent: 'space-between',
			paddingHorizontal: spacing.sm,
		},
		upcomingContactCard: {
			backgroundColor: colors.background.secondary,
			padding: spacing.md,
			borderRadius: layout.borderRadius.md,
			marginBottom: spacing.sm,
			marginHorizontal: spacing.xs,
			width: '47%',
			alignItems: 'center',
			justifyContent: 'center',
		},
		upcomingContactAvatar: {
			width: 50,
			height: 50,
			borderRadius: 25,
			marginBottom: spacing.sm,
		},
		upcomingContactAvatarContainer: {
			width: 50,
			height: 50,
			borderRadius: 25,
			backgroundColor: colors.background.tertiary,
			justifyContent: 'center',
			alignItems: 'center',
			marginBottom: spacing.sm,
		},
		upcomingContactName: {
			fontSize: 16,
			fontWeight: '600',
			color: colors.text.primary,
			marginBottom: spacing.md,
			textAlign: 'center',
			width: '100%',
			flexShrink: 1,
			flexWrap: 'wrap',
			paddingHorizontal: spacing.xs,
		},
		avatarDateContainer: {
			alignItems: 'center',
			justifyContent: 'center',
		},
		upcomingContactDate: {
			fontSize: 16,
			fontWeight: '600',
			color: colors.text.secondary,
			marginTop: spacing.md,
			textAlign: 'center',
		},
		upcomingContactInfo: {
			marginLeft: spacing.sm,
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
		// Call notes on reminders
		cardTitle: {
			fontSize: 20,
			fontWeight: 'bold',
			color: colors.text.primary,
			marginBottom: 5,
		},
		notesContainer: {
			padding: spacing.md,
		},
		notesInput: {
			borderRadius: layout.borderRadius.sm,
			padding: spacing.md,
			minHeight: 80,
			marginBottom: spacing.md,
			fontSize: 16,
		},
		submitButton: {
			backgroundColor: colors.primary,
			padding: 10,
			borderRadius: 8,
			alignItems: 'center',
		},
		submitButtonDisabled: {
			opacity: 0.5,
		},
		submitButtonText: {
			color: '#fff',
			fontWeight: 'bold',
		},
		section: {
			padding: spacing.sm,
			paddingHorizontal: spacing.xs,
			marginTop: 0,
		},
		sectionHeader: {
			fontSize: 16,
			fontWeight: '600',
			color: colors.text.primary,
			textAlign: 'center',
			paddingVertical: spacing.sm,
			marginBottom: spacing.sm,
			backgroundColor: colors.background.secondary,
		},
		groupHeader: {
			flexDirection: 'row',
			justifyContent: 'center',
			paddingTop: spacing.xs,
			paddingBottom: spacing.sm,
			marginBottom: spacing.xs,
		},
		groupTitle: {
			fontSize: 19,
			fontWeight: '700',
			color: colors.text.primary,
			textAlign: 'center',
		},
		content: {
			flex: 1,
		},
		needsAttentionSection: {
			backgroundColor: colors.background.primary,
			marginBottom: spacing.sm,
			paddingTop: spacing.lg,
		},
		upcomingSection: {
			flex: 1,
		},
	});
};

export { useStyles };
