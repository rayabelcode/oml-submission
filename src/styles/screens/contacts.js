import { StyleSheet, Platform, Dimensions } from 'react-native';
import { spacing, layout } from '../../styles/theme';
import { useTheme } from '../../context/ThemeContext';

const useStyles = () => {
	const { colors } = useTheme();

	return StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: colors.background.primary,
		},
		content: {
			flex: 1,
		},
		section: {
			padding: spacing.md,
			paddingHorizontal: spacing.sm,
		},
		grid: {
			flexDirection: 'row',
			flexWrap: 'wrap',
			paddingHorizontal: 0,
			justifyContent: 'flex-start',
		},
		header: {
			padding: spacing.md,
			alignItems: 'center',
			borderBottomWidth: 1,
			borderBottomColor: colors.border,
		},
		logo: {
			width: '50%',
			height: 30,
		},
		buttonContainer: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'center',
			padding: spacing.md,
			gap: spacing.sm,
		},
		importButton: {
			flex: 1,
			flexDirection: 'row',
			alignItems: 'center',
			backgroundColor: colors.primary,
			paddingVertical: 12,
			paddingHorizontal: spacing.md,
			borderRadius: layout.borderRadius.md,
			justifyContent: 'center',
		},
		importButtonText: {
			color: colors.background.primary,
			marginLeft: spacing.sm,
			fontSize: 16,
			fontWeight: '500',
		},
		newButton: {
			flexDirection: 'row',
			alignItems: 'center',
			backgroundColor: colors.background.primary,
			paddingVertical: 11,
			paddingHorizontal: 14,
			borderRadius: layout.borderRadius.md,
			justifyContent: 'center',
			borderWidth: 1.1,
			borderColor: colors.primary,
		},
		newButtonText: {
			color: colors.primary,
			marginLeft: 5,
			fontSize: 16,
			fontWeight: '500',
		},
		card: {
			width: '31%',
			margin: '1%',
			backgroundColor: colors.background.secondary,
			borderRadius: layout.borderRadius.md,
			padding: spacing.md,
			alignItems: 'center',
			borderWidth: 1,
			borderColor: colors.border,
		},
		cardAvatar: {
			width: 60,
			height: 60,
			borderRadius: 30,
			backgroundColor: colors.background.primary,
			justifyContent: 'center',
			alignItems: 'center',
			marginBottom: spacing.sm,
		},
		avatarImage: {
			width: 60,
			height: 60,
			borderRadius: 30,
		},
		avatarText: {
			fontSize: 24,
			fontWeight: '600',
			color: colors.primary,
		},
		nameContainer: {
			width: '100%',
			alignItems: 'center',
		},
		firstName: {
			fontSize: 14,
			fontWeight: '500',
			textAlign: 'center',
			marginTop: 8,
			color: colors.text.primary,
		},
		lastName: {
			fontSize: 14,
			fontWeight: '500',
			textAlign: 'center',
			color: colors.text.primary,
		},
		scheduleBadge: {
			position: 'absolute',
			top: 10,
			right: 10,
			width: 12,
			height: 12,
			borderRadius: 6,
			backgroundColor: colors.background.primary,
			alignItems: 'center',
			justifyContent: 'center',
		},
		scheduleDot: {
			width: 8,
			height: 8,
			borderRadius: 4,
			backgroundColor: colors.secondary,
		},
		actionsContainer: {
			position: 'absolute',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			zIndex: 5,
		},
		cardActions: {
			position: 'absolute',
			top: '50%',
			transform: [{ translateY: -25 }],
			width: 120,
			left: '50%',
			marginLeft: -60,
			backgroundColor: colors.background.primary,
			borderRadius: 15,
			padding: 8,
			borderWidth: 1,
			borderColor: colors.border,
			zIndex: 1,
		},
		actionButtonsContainer: {
			flexDirection: 'row',
			justifyContent: 'space-around',
			alignItems: 'center',
			width: '100%',
		},
		cardActionButton: {
			padding: 8,
			alignItems: 'center',
			justifyContent: 'center',
			width: 44,
			height: 44,
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
			width: Platform.OS === 'web' ? '50%' : '85%',
			alignSelf: 'center',
			maxHeight: Platform.OS === 'ios' ? '75%' : '90%',
			...(Platform.OS === 'ios'
				? {
						height: '75%',
				  }
				: {}),
		},
		modalHeader: {
			flexDirection: 'row',
			justifyContent: 'center',
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
		closeButton: {
			position: 'absolute',
			top: -15,
			right: -15,
			width: 40,
			height: 40,
			borderRadius: 20,
			backgroundColor: colors.background.primary,
			borderWidth: 2,
			borderColor: colors.text.primary,
			alignItems: 'center',
			justifyContent: 'center',
			zIndex: 5,
		},
		editModalActions: {
			flexDirection: 'row',
			justifyContent: 'space-around',
			alignItems: 'center',
			width: '100%',
			marginTop: spacing.md,
		},
		editActionButton: {
			alignItems: 'center',
			padding: spacing.sm,
		},
		editActionText: {
			marginTop: 4,
			fontSize: 12,
			color: colors.text.primary,
		},
		formContainer: {
			paddingHorizontal: spacing.md,
			paddingBottom: spacing.md,
		},
		formInput: {
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: layout.borderRadius.md,
			padding: spacing.md,
			marginBottom: spacing.md,
			fontSize: 16,
			color: colors.text.primary,
			backgroundColor: colors.background.primary,
			height: 50,
		},
		formScrollView: {
			paddingHorizontal: spacing.md,
		},
		photoUploadContainer: {
			alignItems: 'center',
			marginBottom: spacing.md,
		},
		photoPreview: {
			width: 100,
			height: 100,
			borderRadius: 50,
			position: 'relative',
		},
		photoImage: {
			width: '100%',
			height: '100%',
			borderRadius: 50,
		},
		removePhotoButton: {
			position: 'absolute',
			top: -5,
			right: -5,
			backgroundColor: colors.background.primary,
			borderRadius: 12,
		},
		uploadButton: {
			width: 100,
			height: 100,
			borderRadius: 50,
			backgroundColor: colors.background.secondary,
			justifyContent: 'center',
			alignItems: 'center',
			borderWidth: 1,
			borderColor: colors.border,
			borderStyle: 'dashed',
		},
		uploadButtonText: {
			color: colors.primary,
			marginTop: 5,
			fontSize: 12,
		},
		callNotesSection: {
			marginBottom: spacing.md,
			padding: spacing.md,
		},
		callNotesInput: {
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: layout.borderRadius.md,
			padding: spacing.sm,
			minHeight: 100,
			marginBottom: spacing.sm,
			fontSize: 16,
			color: colors.text.primary,
			backgroundColor: colors.background.primary,
		},
		callNotesControls: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'center',
		},
		dateButton: {
			backgroundColor: colors.background.secondary,
			padding: spacing.sm,
			borderRadius: layout.borderRadius.sm,
			flex: 1,
			marginRight: spacing.sm,
		},
		dateButtonText: {
			fontSize: 16,
			color: colors.text.primary,
			fontWeight: '500',
		},
		submitCallButton: {
			backgroundColor: colors.secondary,
			padding: spacing.sm,
			borderRadius: layout.borderRadius.sm,
			width: 100,
			alignItems: 'center',
		},
		historySection: {
			marginBottom: spacing.md,
		},
		historyEntry: {
			marginBottom: spacing.sm,
			padding: spacing.sm,
			backgroundColor: colors.background.secondary,
			borderRadius: layout.borderRadius.md,
		},
		historyDate: {
			fontSize: 14,
			color: colors.text.secondary,
			marginBottom: 5,
		},
		historyNotes: {
			fontSize: 16,
			color: colors.text.primary,
		},
		historyNotesInput: {
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: 5,
			padding: 8,
			marginTop: 5,
			backgroundColor: colors.background.secondary,
		},
		historyActions: {
			flexDirection: 'row',
			justifyContent: 'flex-end',
			marginTop: spacing.sm,
		},
		historyActionButton: {
			padding: 8,
			marginLeft: 8,
		},
		emptyHistoryText: {
			textAlign: 'center',
			color: colors.text.secondary,
			fontSize: 14,
			fontStyle: 'italic',
			padding: spacing.md,
			backgroundColor: colors.background.secondary,
			borderRadius: layout.borderRadius.md,
		},
		scheduleContainer: {
			alignItems: 'center',
			marginVertical: spacing.md,
		},
		scheduleLabel: {
			fontSize: 14,
			color: colors.text.secondary,
			marginBottom: 8,
		},
		selectedDate: {
			fontSize: 24,
			fontWeight: 'bold',
			color: colors.text.primary,
		},
		scheduleActions: {
			flexDirection: 'row',
			justifyContent: 'center',
			marginTop: spacing.md,
		},
		confirmButton: {
			backgroundColor: colors.primary,
			paddingVertical: 12,
			paddingHorizontal: 30,
			borderRadius: layout.borderRadius.sm,
			alignSelf: 'center',
			marginTop: spacing.md,
		},
		confirmButtonText: {
			color: colors.background.primary,
			fontSize: 16,
			fontWeight: '500',
		},
		removeScheduleButton: {
			marginTop: spacing.sm,
			padding: spacing.sm,
		},
		removeScheduleText: {
			color: colors.danger,
			fontSize: 14,
			textAlign: 'center',
		},
		tagsContainer: {
			flexDirection: 'row',
			flexWrap: 'wrap',
			padding: spacing.sm,
			gap: 8,
		},
		tagBubble: {
			flexDirection: 'row',
			alignItems: 'center',
			backgroundColor: colors.background.secondary,
			borderRadius: 15,
			paddingVertical: 5,
			paddingHorizontal: spacing.sm,
		},
		tagText: {
			color: colors.primary,
			marginRight: 5,
		},
		tagInput: {
			flex: 1,
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: layout.borderRadius.sm,
			padding: 12,
			marginRight: spacing.sm,
			fontSize: 16,
			color: colors.text.primary,
		},
		tagInputContainer: {
			flexDirection: 'row',
			marginBottom: spacing.sm,
		},
		addTagButton: {
			backgroundColor: colors.primary,
			paddingHorizontal: spacing.md,
			paddingVertical: 12,
			borderRadius: layout.borderRadius.sm,
			justifyContent: 'center',
		},
		suggestionsContainer: {
			marginTop: 0,
			marginBottom: spacing.md,
			padding: spacing.sm,
			backgroundColor: colors.background.secondary,
			borderRadius: layout.borderRadius.sm,
		},
		suggestionsTitle: {
			fontSize: 16,
			fontWeight: '600',
			color: colors.text.primary,
			marginBottom: 5,
		},
		suggestionsText: {
			fontSize: 14,
			color: colors.text.secondary,
			textAlign: 'center',
		},
		suggestion: {
			fontSize: 14,
			color: colors.text.primary,
			marginBottom: 8,
			paddingLeft: 0,
		},
		datePickerModalOverlay: {
			flex: 1,
			backgroundColor: colors.background.overlay,
			justifyContent: 'center',
			alignItems: 'center',
		},
		datePickerContainer: {
			backgroundColor: colors.background.primary,
			padding: spacing.md,
			borderRadius: layout.borderRadius.md,
			minWidth: 300,
		},
		searchInput: {
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: layout.borderRadius.md,
			padding: spacing.md,
			marginBottom: spacing.md,
			fontSize: 16,
			backgroundColor: colors.background.primary,
			color: colors.text.primary,
		},
		searchResults: {
			maxHeight: '80%',
		},
		searchResultItem: {
			padding: spacing.md,
			borderBottomWidth: 1,
			borderBottomColor: colors.border,
		},
		searchResultText: {
			fontSize: 16,
			color: colors.text.primary,
		},
		message: {
			textAlign: 'center',
			padding: spacing.md,
			color: colors.text.secondary,
			fontSize: 16,
		},
		sectionTitle: {
			fontSize: 16,
			fontWeight: '500',
			marginBottom: spacing.sm,
			color: colors.text.primary,
		},
	});
};

export { useStyles };
