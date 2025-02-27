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
		card: {
			marginBottom: spacing.lg,
			marginHorizontal: spacing.sm,
			borderRadius: layout.borderRadius.md,
			overflow: 'hidden',
		},
		cardContent: {
			width: '100%',
			padding: spacing.md,
			alignItems: 'center',
			backgroundColor: 'transparent',
			borderLeftWidth: spacing.xs,
			borderRightWidth: spacing.xs,
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
			marginLeft: spacing.sm,
			fontSize: 16,
			fontWeight: '700',
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
			fontWeight: '600',
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
			fontSize: 15,
			fontWeight: '500',
			color: colors.text.secondary,
			textAlign: 'center',
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
			marginBottom: spacing.xs,
			color: colors.text.primary,
		},
		cardDate: {
			fontSize: 16,
			color: colors.text.secondary,
			marginBottom: 10,
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
			paddingHorizontal: spacing.md,
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
		submitButtonContainer: {
			flexDirection: 'row',
			justifyContent: 'center',
		},
		submitButton: {
			backgroundColor: colors.primary,
			paddingHorizontal: spacing.xl,
			paddingVertical: spacing.sm,
			borderRadius: layout.borderRadius.md,
			alignSelf: 'center',
		},
		submitButtonDisabled: {
			opacity: 0.5,
		},
		submitButtonText: {
			color: colors.text.white,
			fontSize: 18,
			fontWeight: 700,
		},
		section: {
			marginTop: spacing.md,
			paddingHorizontal: spacing.md,
			marginBottom: spacing.xl,
		},
		groupHeader: {
			flexDirection: 'row',
			justifyContent: 'center',
			paddingTop: spacing.xs,
			paddingBottom: spacing.sm,
		},
		groupTitle: {
			fontSize: 20,
			fontWeight: '700',
			color: colors.text.primary,
			textAlign: 'center',
			opacity: 0.9,
		},
		content: {
			flex: 1,
		},
		needsAttentionSection: {
			backgroundColor: colors.background.primary,
			marginBottom: spacing.sm,
		},
		// Suggested Calls
		attentionItem: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'center',
			paddingVertical: spacing.md,
		},
		attentionInfo: {
			flex: 1,
		},
		contactName: {
			fontSize: 18,
			fontWeight: '700',
			color: colors.text.primary,
			marginBottom: spacing.xs,
			opacity: 0.8,
		},
		suggestedContactName: {
			fontSize: 18,
			fontWeight: '800',
			color: colors.text.primary,
			marginLeft: spacing.md,
		},
		callButton: {
			flexDirection: 'row',
			alignItems: 'center',
			backgroundColor: colors.primary,
			paddingHorizontal: spacing.md,
			paddingVertical: spacing.sm,
			borderRadius: layout.borderRadius.sm,
			marginLeft: spacing.md,
		},
		callButtonText: {
			color: colors.text.white,
			marginLeft: spacing.sm,
			fontSize: 16,
			fontWeight: '700',
		},
		sectionDescription: {
			fontSize: 14,
			color: colors.text.secondary,
			textAlign: 'center',
			marginTop: -spacing.md,
			marginBottom: spacing.md,
		},
		emptyMessage: {
			textAlign: 'center',
			color: colors.text.secondary,
			fontSize: 16,
			fontStyle: 'italic',
			paddingVertical: spacing.md,
		},
	});
};

export { useStyles };
