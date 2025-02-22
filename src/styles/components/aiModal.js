import { StyleSheet, Dimensions } from 'react-native';

const { height: screenHeight } = Dimensions.get('window');
const MODAL_HEIGHT = screenHeight * 0.7;

export const createStyles = (colors, spacing, layout) =>
	StyleSheet.create({
		modalContainer: {
			flex: 1,
			justifyContent: 'center',
			alignItems: 'center',
			backgroundColor: colors.background.overlay,
		},
		modalContent: {
			width: '85%',
			maxWidth: 340,
			height: MODAL_HEIGHT,
			backgroundColor: colors.background.primary,
			borderRadius: layout.borderRadius.lg,
			padding: spacing.lg,
		},
		headerContainer: {
			width: '100%',
		},
		headerRow: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			marginBottom: spacing.md,
		},
		headerLeft: {
			width: 35, // Match the close button size
		},
		headerRight: {
			padding: spacing.md,
			margin: -spacing.md,
		},
		modalTitle: {
			fontSize: 22,
			fontWeight: '700',
			color: colors.text.primary,
			textAlign: 'center',
		},
		tabSelector: {
			flexDirection: 'row',
			marginBottom: spacing.md,
			borderRadius: layout.borderRadius.md,
			backgroundColor: colors.background.secondary,
			padding: spacing.xs,
		},
		tab: {
			flex: 1,
			paddingVertical: spacing.sm,
			alignItems: 'center',
			borderRadius: layout.borderRadius.sm,
		},
		activeTab: {
			backgroundColor: colors.primary,
		},
		tabText: {
			color: colors.text.secondary,
			fontWeight: '800',
			fontSize: 16,
		},
		activeTabText: {
			color: colors.text.white,
		},
		contentContainer: {
			flex: 1,
			minHeight: MODAL_HEIGHT - 150,
		},
		scrollContent: {
			flexGrow: 1,
		},
		tabContent: {
			flex: 1,
		},
		section: {
			marginBottom: spacing.md,
		},
		sectionTitle: {
			fontSize: 18,
			fontWeight: '600',
			color: colors.text.primary,
			marginBottom: spacing.sm,
			textAlign: 'center',
			marginTop: spacing.md,
		},
		suggestionCard: {
			backgroundColor: colors.background.secondary,
			padding: spacing.md,
			borderRadius: layout.borderRadius.md,
			marginBottom: spacing.sm,
		},
		flowStep: {
			flexDirection: 'row',
			alignItems: 'flex-start',
			marginBottom: spacing.sm,
		},
		stepContent: {
			flex: 1,
		},
		closeButton: {
			position: 'absolute',
			top: spacing.sm,
			right: spacing.md,
			padding: spacing.md,
			margin: -spacing.md,
			zIndex: 1,
		},
		loadingContainer: {
			flex: 1,
			justifyContent: 'center',
			alignItems: 'center',
			padding: spacing.lg,
		},
		loadingText: {
			marginTop: spacing.sm,
			color: colors.text.primary,
		},
		suggestionText: {
			color: colors.text.primary,
			fontSize: 16,
			fontWeight: '500',
		},
		stepTitle: {
			color: colors.text.secondary,
			fontWeight: '600',
			fontSize: 20,
			textAlign: 'left',
			marginTop: spacing.md,
			marginBottom: spacing.xs,
		},
		stepDescription: {
			color: colors.text.primary,
			fontSize: 16,
			fontWeight: '500',
			textAlign: 'left',
			marginBottom: spacing.md,
		},
		birthdayAlert: {
			flexDirection: 'row',
			alignItems: 'center',
			backgroundColor: colors.background.secondary,
			padding: spacing.md,
			borderRadius: layout.borderRadius.md,
			marginBottom: spacing.md,
		},
		birthdayText: {
			color: colors.text.primary,
			marginLeft: spacing.md,
			fontSize: 16,
			fontWeight: '800',
			flex: 1,
		},
	});
