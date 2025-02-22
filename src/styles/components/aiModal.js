import { StyleSheet } from 'react-native';

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
			backgroundColor: colors.background.primary,
			borderRadius: layout.borderRadius.lg,
			padding: spacing.lg,
			maxHeight: '80%',
		},
		modalTitle: {
			fontSize: 22,
			fontWeight: '700',
			color: colors.text.primary,
			marginBottom: spacing.md,
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
			fontWeight: '600',
		},
		activeTabText: {
			color: colors.text.white,
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
			top: spacing.md,
			right: spacing.md,
			padding: spacing.xs,
		},
		loadingContainer: {
			padding: spacing.lg,
			alignItems: 'center',
		},
		loadingText: {
			marginTop: spacing.sm,
			color: colors.text.primary,
		},
		suggestionText: {
			color: colors.text.primary,
		},
		stepTitle: {
			color: colors.text.primary,
			fontWeight: '600',
			fontSize: 18,
			textAlign: 'center',
			marginTop: spacing.md,
			marginBottom: spacing.xs,
		},
		stepDescription: {
			color: colors.text.primary,
			textAlign: 'center',
			marginBottom: spacing.md,
		},
	});
