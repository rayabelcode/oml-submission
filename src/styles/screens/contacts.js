import { StyleSheet, Platform, StatusBar } from 'react-native';
import { spacing, layout, useTheme } from '../../context/ThemeContext';

const useStyles = () => {
	const { colors } = useTheme();

	return StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: colors.background.primary,
			paddingTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight,
		},
		mainContainer: {
			flex: 1,
			width: '100%',
		},
		scrollContent: {
			flexGrow: 1,
			paddingBottom: 20,
			pointerEvents: 'box-none',
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
		headerActions: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'flex-end', // Icons to the right
			gap: spacing.lg, // Spacing between icons
		},		
		logo: {
			width: '30%',
			height: 15,
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
			gap: 8,
		},
		importButtonText: {
			color: colors.background.primary,
			marginLeft: spacing.sm,
			fontSize: 16,
			fontWeight: '600',
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
		// Tabs
		tabBar: {
			flexDirection: 'row',
			backgroundColor: colors.background.primary,
			borderBottomWidth: 1,
			borderBottomColor: colors.border,
		},
		tabIndicator: {
			backgroundColor: colors.primary,
			height: 2,
		},
		tabLabel: {
			fontWeight: 'bold',
			fontSize: 12,
			textTransform: 'uppercase',
			paddingVertical: spacing.sm,
		},
		tabItem: {
			flex: 1,
			alignItems: 'center',
			paddingVertical: spacing.md,
		},
		activeTab: {
			borderBottomWidth: 2,
			borderBottomColor: colors.primary,
		},
		tabLabel: {
			fontSize: 12,
			marginTop: spacing.xs,
			color: colors.text.secondary,
		},
		activeTabLabel: {
			color: colors.primary,
		},
		tabContent: {
			flex: 1,
			padding: spacing.sm,
			width: '100%',
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
			justifyContent: 'center',
			gap: spacing.xl,
			paddingVertical: spacing.md,
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
			marginBottom: spacing.sm,
			position: 'relative',
			paddingHorizontal: spacing.sm,
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
			paddingHorizontal: spacing.sm,
			paddingTop: spacing.sm, // Add top padding
		},
		photoUploadContainer: {
			alignItems: 'center',
			marginBottom: spacing.md,
			paddingTop: spacing.xs || 5, // Add top padding
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
			paddingHorizontal: 0,
		},
		historyEntry: {
			marginBottom: spacing.sm,
			padding: spacing.sm,
			backgroundColor: colors.background.secondary,
			borderRadius: layout.borderRadius.md,
			marginHorizontal: 0, // Full width
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
			padding: spacing.sm,
			backgroundColor: colors.background.secondary,
			borderRadius: layout.borderRadius.md,
			marginHorizontal: 0, // Full width
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
			flexDirection: 'column',
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
			borderWidth: 1,
			borderColor: colors.danger,
			borderRadius: layout.borderRadius.sm,
			width: '100%',
			alignItems: 'center',
		},
		removeScheduleText: {
			color: colors.danger,
			fontSize: 14,
			textAlign: 'center',
		},
		tagsContainer: {
			flexDirection: 'row',
			flexWrap: 'wrap',
			justifyContent: 'center',
			alignItems: 'center',
			paddingHorizontal: 15,
			gap: 8,
		},
		tagBubble: {
			flexDirection: 'row',
			alignItems: 'center',
			backgroundColor:
				colors.background.primary === '#FFFFFF'
					? '#EDF3F8' // Light blue-gray for light mode
					: '#2C3E50', // Keep current dark mode color
			borderRadius: 20,
			paddingVertical: 9,
			paddingHorizontal: 16,
			marginBottom: 8,
			elevation: 2,
			borderWidth: 1,
			borderColor:
				colors.background.primary === '#FFFFFF'
					? '#E0E8EF' // Light border for light mode
					: '#536878', // Keep current dark mode border
		},
		tagText: {
			fontSize: 14,
			marginRight: 4,
			color: colors.text.primary,
			fontWeight: '500',
			letterSpacing: 0.3,
		},
		tagInput: {
			height: 44,
			borderWidth: 2,
			borderColor: colors.border,
			borderRadius: layout.borderRadius.md,
			fontSize: 16,
			textAlign: 'center',
			color: colors.text.primary,
			marginBottom: 8,
			width: '100%',
			backgroundColor: colors.background.primary,
		},
		tagInputContainer: {
			flexDirection: 'row',
			marginBottom: spacing.sm,
		},
		tagInputWrapper: {
			marginVertical: 20,
			paddingHorizontal: 20,
		},
		tagInputHelper: {
			textAlign: 'center',
			color: colors.text.secondary,
			fontSize: 14,
			marginTop: 8,
			fontStyle: 'italic',
		},
		tagDeleteIcon: {
			marginLeft: 2,
		},
		addTagButton: {
			backgroundColor: colors.primary,
			paddingHorizontal: spacing.md,
			paddingVertical: 12,
			borderRadius: layout.borderRadius.sm,
			justifyContent: 'center',
		},
		suggestionsContainer: {
			gap: spacing.md,
			padding: spacing.md,
			flex: 1,
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
			fontSize: 16,
			color: colors.text.primary,
			lineHeight: 22,
			paddingHorizontal: spacing.md,
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
			fontSize: 17,
			fontWeight: '700',
			marginBottom: spacing.md,
			color: colors.text.primary,
			textAlign: 'center',
		},
		// Edit tab
		contactHeader: {
			width: '100%',
			alignItems: 'center',
			flexDirection: 'column',
			padding: spacing.md,
		},
		photoWrapper: {
			width: '100%',
			alignItems: 'center',
			marginBottom: spacing.xs,
		},
		photoContainer: {
			width: 100,
			alignItems: 'center',
		},
		contactInfo: {
			flex: 1,
			paddingTop: spacing.sm,
		},
		fullName: {
			fontSize: 24,
			fontWeight: '600',
			color: colors.text.primary,
			marginBottom: spacing.md,
		},
		// Contact Info on Profile tab
		contactDetail: {
			fontSize: 16,
			color: colors.text.primary,
			marginVertical: spacing.sm,
			textAlign: 'center',
		},
		centeredDetails: {
			alignItems: 'center',
			justifyContent: 'center',
			paddingVertical: spacing.md,
		},
		editFields: {
			width: '100%',
		},
		editInput: {
			fontSize: 16,
			color: colors.text.primary,
			borderBottomWidth: 1,
			borderBottomColor: colors.border,
			paddingVertical: spacing.sm,
			marginBottom: spacing.md,
			textAlign: 'center', // Add this line
			width: '100%', // Add this line
		},
		editActions: {
			flexDirection: 'row',
			justifyContent: 'flex-end',
			gap: spacing.sm,
			marginTop: spacing.md,
		},
		actionButtons: {
			flexDirection: 'row',
			justifyContent: 'center',
			gap: spacing.xl,
			paddingVertical: spacing.lg,
			marginTop: spacing.xl,
		},
		actionButton: {
			alignItems: 'center',
			padding: spacing.sm,
			minWidth: 80,
		},
		actionButtonText: {
			fontSize: 12,
			marginTop: spacing.xs,
		},
		headerButtons: {
			flexDirection: 'row',
			justifyContent: 'center',
			alignItems: 'center',
			width: '100%',
			gap: spacing.sm,
		},
		headerButton: {
			paddingHorizontal: spacing.xs, // Padding between icons
			paddingVertical: spacing.xs, // Vertical padding for tap area
			marginRight: 0,
		},
		saveButtonText: {
			color: colors.background.primary,
			fontWeight: '600',
		},
		cancelButtonText: {
			fontWeight: '500',
		},
		editButtonText: {
			color: colors.background.primary,
			fontWeight: '500',
		},
		contactDetails: {
			padding: spacing.md,
			marginTop: spacing.xs,
		},
		separator: {
			height: 1,
			backgroundColor: colors.border,
			marginTop: spacing.md,
			marginBottom: spacing.xs,
		},
		editButton: {
			backgroundColor: colors.primary,
		},
		archiveButton: {
			backgroundColor: colors.background.primary,
		},
		deleteButton: {
			backgroundColor: colors.background.primary,
		},
		saveButton: {
			backgroundColor: colors.primary,
			marginRight: spacing.xs,
		},
		cancelButton: {
			backgroundColor: colors.background.primary,
			borderWidth: 2,
			borderColor: colors.border,
		},
		buttonText: {
			color: colors.background.primary,
			fontSize: 14,
			fontWeight: '500',
		},
		contentContainer: {
			flexGrow: 1,
			width: '100%',
		},
		viewFields: {
			flex: 1,
		},
		aiButton: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			backgroundColor: colors.primary,
			padding: spacing.md,
			borderRadius: layout.borderRadius.md,
			marginTop: spacing.sm,
			marginBottom: spacing.lg,
			gap: spacing.sm,
			elevation: 2,
			shadowColor: '#000',
			shadowOffset: { width: 0, height: 2 },
			shadowOpacity: 0.2,
			shadowRadius: 2,
		},
		aiButtonText: {
			color: colors.background.primary,
			fontSize: 18,
			fontWeight: '600',
		},
		aiModalContainer: {
			position: 'absolute',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			backgroundColor: 'rgba(0,0,0,1)',
			justifyContent: 'center',
			alignItems: 'center',
			width: '100%',
			height: '100%',
			zIndex: 9999,
		},
		modalTitleContainer: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: spacing.sm,
		},
		aiSubtitle: {
			fontSize: 16,
			fontStyle: 'italic',
			color: colors.text.primary,
			textAlign: 'center',
			backgroundColor:
				colors.background.primary === '#FFFFFF'
					? '#F0F7FF' // Light mode
					: '#2A2A2A', // Dark mode
			padding: spacing.md,
			width: '100%',
		},
		aiModalContent: {
			backgroundColor: colors.background.primary,
			borderRadius: layout.borderRadius.lg,
			padding: 0,
			width: Platform.OS === 'web' ? '50%' : '85%',
			maxHeight: '80%',
			paddingTop: spacing.md,
		},
		aiModalScrollContent: {
			padding: spacing.md,
			flexGrow: 1,
		},
		// Scheduling
		frequencyPicker: {
			flexDirection: 'row',
			flexWrap: 'wrap',
			gap: 10,
			marginTop: 10,
			marginBottom: spacing.md,
		},
		frequencyOption: {
			paddingVertical: 8,
			paddingHorizontal: 16,
			borderRadius: 20,
			backgroundColor: colors.background.secondary,
			borderWidth: 1,
			borderColor: colors.border,
		},
		frequencyOptionSelected: {
			backgroundColor: colors.primary,
			borderColor: colors.primary,
		},
		frequencyText: {
			color: colors.text.primary,
			fontSize: 14,
		},
		frequencyTextSelected: {
			color: colors.background.primary,
			fontWeight: '500',
		},
		advancedSettingsButton: {
			flexDirection: 'row',
			alignItems: 'center',
			paddingVertical: 12,
			paddingHorizontal: spacing.md,
			borderRadius: layout.borderRadius.md,
			backgroundColor: colors.background.secondary,
			marginVertical: spacing.md,
		},
		advancedSettingsText: {
			color: colors.text.secondary,
			marginLeft: spacing.sm,
			fontSize: 14,
		},
		advancedSettings: {
			marginTop: spacing.sm,
			padding: spacing.md,
			backgroundColor: colors.background.secondary,
			borderRadius: layout.borderRadius.md,
			borderWidth: 1,
			borderColor: colors.border,
		},
		settingsNote: {
			color: colors.text.secondary,
			fontStyle: 'italic',
			fontSize: 14,
			textAlign: 'center',
		},
		nextContactContainer: {
			alignItems: 'center',
			backgroundColor: colors.background.secondary,
			padding: spacing.md,
			borderRadius: layout.borderRadius.md,
			marginBottom: spacing.md,
		},
		nextContactLabel: {
			fontSize: 14,
			color: colors.text.secondary,
			marginBottom: spacing.xs,
		},
		nextContactDate: {
			fontSize: 18,
			fontWeight: '600',
			color: colors.text.primary,
		},
		callIconButton: {
			position: 'absolute',
			left: -18,
			top: -18,
			width: 50,
			height: 50,
			borderRadius: 50,
			backgroundColor: colors.secondary, // Green color like Submit button
			borderWidth: 2,
			borderColor: colors.background.primary,
			alignItems: 'center',
			justifyContent: 'center',
			zIndex: 5,
			elevation: 3, // For Android
			shadowColor: '#000', // For iOS
			shadowOffset: {
				width: 0,
				height: 2,
			},
			shadowOpacity: 0.25,
			shadowRadius: 3.84,
		},
		headerContent: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			width: '100%',
			paddingHorizontal: spacing.xs,
		},
		searchInput: {
			backgroundColor: colors.background.secondary,
			borderRadius: layout.borderRadius.md,
			padding: spacing.sm,
			marginTop: spacing.sm,
			marginHorizontal: spacing.md,
			fontSize: 16,
			color: colors.text.primary,
			height: 40,
		},
	});
};

export { useStyles };
