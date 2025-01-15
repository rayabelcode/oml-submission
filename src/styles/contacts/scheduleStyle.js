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
		buttonContent: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
		},
		// Action Buttons
		actionButtonsContainer: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			marginBottom: spacing.lg,
			gap: spacing.sm,
		},
		customDateText: {
			color: colors.primary,
			fontSize: 16,
			fontWeight: '700',
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
		recurringOffText: {
			color: colors.text.lightWarning,
			fontSize: 18,
			fontWeight: '700',
		},
		recurringOffButton: {
			flex: 1,
			backgroundColor: colors.lightWarning,
			borderRadius: layout.borderRadius.md,
			paddingVertical: spacing.md,
			alignItems: 'center',
			justifyContent: 'center',
			borderWidth: 1,
			borderColor: colors.lightWarning,
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
		dateSection: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'flex-start',
			marginBottom: 20,
		},
		nextContactContainer: {
			flex: 1,
			padding: 15,
			backgroundColor: 'transparent',
		},
		scheduledDatesContainer: {
			flex: 0.7,
			backgroundColor: colors.background.secondary,
			borderRadius: 8,
			padding: 15,
			borderWidth: 1,
			borderColor: colors.border.light,
			marginLeft: spacing.md,
		},
		scheduledDateRow: {
			fontSize: 14,
			color: colors.text.primary,
			marginBottom: 4,
		},
		nextContactLabel: {
			fontSize: 15,
			color: colors.text.secondary,
			marginBottom: spacing.xs,
		},
		nextContactDate: {
			fontSize: 20,
			fontWeight: '600',
			color: colors.text.primary,
			height: 30, // Match height of dotsContainer
			lineHeight: 30,
		},
		unscheduledText: {
			color: colors.text.primary,
			fontWeight: '500',
		},
		// Animated Loading Screen
		dotsContainer: {
			height: 30, // Match height of nextContactDate
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
		},
		dot: {
			width: 8,
			height: 8,
			borderRadius: 3,
			backgroundColor: colors.text.primary,
			marginHorizontal: 8, // Spacing between dots
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
			opacity: 0.3,
			pointerEvents: 'none',
		},
		disabledText: {
			opacity: 0.3,
		},
		// SlotsFilledModal
		modalOverlay: {
			flex: 1,
			backgroundColor: 'rgba(0, 0, 0, 0.5)',
			justifyContent: 'center',
			alignItems: 'center',
		},
		modalContent: {
			backgroundColor: colors.background.primary,
			borderRadius: 12,
			padding: spacing.lg,
			width: '90%',
			maxWidth: 400,
		},
		modalTitle: {
			fontSize: 18,
			fontWeight: '600',
			color: colors.text.primary,
			marginBottom: spacing.sm,
			textAlign: 'center',
		},
		modalMessage: {
			fontSize: 16,
			color: colors.text.secondary,
			marginBottom: spacing.md,
			textAlign: 'center',
		},
		modalOptions: {
			marginVertical: spacing.md,
		},
		modalOption: {
			paddingVertical: spacing.sm,
			paddingHorizontal: spacing.md,
			borderRadius: 8,
			bbackgroundColor: colors.background.secondary,
			marginBottom: spacing.sm,
		},
		modalOptionText: {
			fontSize: 16,
			color: colors.text.primary,
			textAlign: 'center',
		},
		modalCloseButton: {
			marginTop: spacing.sm,
			padding: spacing.sm,
			alignItems: 'center',
		},
		modalCloseText: {
			color: colors.text.secondary,
			fontSize: 16,
		},
	});
};
