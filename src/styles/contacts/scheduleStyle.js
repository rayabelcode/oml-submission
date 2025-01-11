import { StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export const useScheduleStyles = () => {
	const { colors, spacing, layout } = useTheme();

	return StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: colors.background.primary,
			padding: spacing.md,
		},
		// Frequency Grid
		gridContainer: {
			marginBottom: spacing.lg,
		},
		frequencyGrid: {
			flexDirection: 'row',
			flexWrap: 'wrap',
			justifyContent: 'space-between',
			gap: spacing.sm,
		},
		frequencyButton: {
			width: '31%',
			backgroundColor: colors.background.secondary,
			borderRadius: layout.borderRadius.md,
			paddingVertical: spacing.md,
			alignItems: 'center',
			justifyContent: 'center',
			borderWidth: 1,
			borderColor: colors.border,
		},
		frequencyButtonActive: {
			backgroundColor: colors.primary,
			borderColor: colors.primary,
		},
		frequencyText: {
			fontSize: 14,
			color: colors.text.primary,
			textAlign: 'center',
		},
		frequencyTextActive: {
			color: colors.background.primary,
			fontWeight: '500',
		},

		// Action Buttons
		actionButtonsContainer: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			marginBottom: spacing.lg,
			gap: spacing.sm,
		},
		customDateButton: {
			flex: 1,
			backgroundColor: colors.background.secondary,
			borderRadius: layout.borderRadius.md,
			paddingVertical: spacing.md,
			alignItems: 'center',
			justifyContent: 'center',
			borderWidth: 1,
			borderColor: colors.primary,
		},
		recurringOffButton: {
			flex: 1,
			backgroundColor: colors.background.tertiary,
			borderRadius: layout.borderRadius.md,
			paddingVertical: spacing.md,
			alignItems: 'center',
			justifyContent: 'center',
			borderWidth: 1,
			borderColor: colors.border,
		},
		customDateText: {
			color: colors.primary,
			fontSize: 14,
			fontWeight: '500',
		},
		recurringOffText: {
			color: colors.text.secondary,
			fontSize: 14,
		},

		// Advanced Settings
		advancedSettingsButton: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			paddingVertical: spacing.sm,
			marginBottom: spacing.md,
		},
		advancedSettingsText: {
			color: colors.text.secondary,
			marginLeft: spacing.xs,
			fontSize: 14,
		},

		// Priority Section
		priorityContainer: {
			marginBottom: spacing.lg,
		},
		sectionTitle: {
			fontSize: 16,
			fontWeight: '600',
			color: colors.text.primary,
			marginBottom: spacing.sm,
			textAlign: 'center',
		},
		priorityButtons: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			gap: spacing.sm,
		},
		priorityButton: {
			flex: 1,
			backgroundColor: colors.background.secondary,
			borderRadius: layout.borderRadius.md,
			paddingVertical: spacing.md,
			alignItems: 'center',
			justifyContent: 'center',
			borderWidth: 1,
			borderColor: colors.border,
		},
		priorityButtonActive: {
			backgroundColor: colors.primary,
			borderColor: colors.primary,
		},
		priorityText: {
			fontSize: 14,
			color: colors.text.primary,
			textAlign: 'center',
		},
		priorityTextActive: {
			color: colors.background.primary,
			fontWeight: '500',
		},

		// Preferred Days
		daysContainer: {
			marginBottom: spacing.lg,
		},
		daysGrid: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			paddingHorizontal: spacing.xs,
		},
		dayButton: {
			width: 36,
			height: 36,
			borderRadius: 18,
			backgroundColor: colors.background.secondary,
			alignItems: 'center',
			justifyContent: 'center',
			borderWidth: 1,
			borderColor: colors.border,
		},
		dayButtonActive: {
			backgroundColor: colors.primary,
			borderColor: colors.primary,
		},
		dayText: {
			fontSize: 13,
			color: colors.text.primary,
		},
		dayTextActive: {
			color: colors.background.primary,
			fontWeight: '500',
		},

		// Active Hours
		hoursContainer: {
			marginBottom: spacing.lg,
		},
		hoursRow: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			gap: spacing.sm,
		},
		timeButton: {
			flex: 1,
			backgroundColor: colors.background.secondary,
			borderRadius: layout.borderRadius.md,
			paddingVertical: spacing.md,
			alignItems: 'center',
			justifyContent: 'center',
			borderWidth: 1,
			borderColor: colors.border,
		},
		timeText: {
			fontSize: 14,
			color: colors.text.primary,
		},

		// Next Contact Display
		nextContactContainer: {
			borderRadius: layout.borderRadius.md,
			padding: spacing.md,
			marginTop: spacing.lg,
			alignItems: 'center',
			borderWidth: 1,
			borderColor: colors.border,
		},
		nextContactLabel: {
			fontSize: 16,
			color: colors.text.secondary,
			marginBottom: spacing.xs,
		},
		nextContactDate: {
			fontSize: 20,
			fontWeight: '600',
			color: colors.text.primary,
		},

		// Loading and Error States
		loadingOverlay: {
			...StyleSheet.absoluteFillObject,
			backgroundColor: colors.background.overlay,
			alignItems: 'center',
			justifyContent: 'center',
			zIndex: 1000,
		},
		errorText: {
			color: colors.error,
			fontSize: 14,
			textAlign: 'center',
			marginTop: spacing.xs,
		},
		disabledButton: {
			opacity: 0.5,
		},
	});
};
