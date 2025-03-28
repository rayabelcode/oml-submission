import { StyleSheet, Platform } from 'react-native';
import { spacing, layout } from '../../context/ThemeContext';

export const useStyles = (colors) => {
	return StyleSheet.create({
		safeArea: {
			flex: 1,
			backgroundColor: colors.background.primary,
		},
		container: {
			flex: 1,
			backgroundColor: colors.background.primary,
			paddingTop: Platform.OS === 'ios' ? 50 : 20,
		},
		statsContainer: {
			flex: 1,
			backgroundColor: colors.background.primary,
		},
		contentContainer: {
			paddingHorizontal: spacing.md,
			paddingTop: spacing.md,
			paddingBottom: spacing.xl * 2,
		},
		section: {
			marginBottom: spacing.xl,
			backgroundColor: colors.background.secondary,
			borderRadius: layout.borderRadius.md,
			padding: spacing.md,
		},
		sectionTitle: {
			fontSize: 19,
			fontWeight: 'bold',
			marginTop: spacing.xs,
			marginBottom: spacing.lg,
			color: colors.text.primary,
			textAlign: 'center',
		},
		subsectionTitle: {
			fontSize: 16,
			fontWeight: '600',
			marginTop: spacing.md,
			marginBottom: spacing.sm,
			color: colors.text.secondary,
		},
		statsGrid: {
			flexDirection: 'row',
			flexWrap: 'wrap',
			justifyContent: 'space-between',
		},
		statBox: {
			width: '48%',
			padding: spacing.md,
			marginBottom: spacing.md,
			borderRadius: layout.borderRadius.sm,
			backgroundColor: colors.background.tertiary,
			alignItems: 'center',
		},
		statTitle: {
			fontSize: 14,
			fontWeight: '800',
			marginTop: spacing.xs,
			color: colors.text.primary,
			opacity: 0.75,
		},
		statValue: {
			fontSize: 24,
			fontWeight: 'bold',
			marginTop: spacing.xs,
			color: colors.text.primary,
		},
		statSubtitle: {
			fontSize: 12,
			color: colors.text.secondary,
			fontWeight: '500',
			marginTop: spacing.xs,
			textAlign: 'center',
		},
		message: {
			fontSize: 16,
			color: colors.text.secondary,
			textAlign: 'center',
			paddingVertical: spacing.md,
		},
		distributionGrid: {
			flexDirection: 'row',
			flexWrap: 'wrap',
			justifyContent: 'space-between',
			paddingHorizontal: spacing.sm,
		},
		distributionItem: {
			width: '48%',
			padding: spacing.md,
			marginBottom: spacing.md,
			borderRadius: layout.borderRadius.sm,
			backgroundColor: colors.background.tertiary,
			alignItems: 'center',
		},
		distributionHeader: {
			flexDirection: 'row',
			alignItems: 'center',
			marginBottom: spacing.xs,
			gap: spacing.xs,
		},
		distributionCount: {
			fontSize: 24,
			fontWeight: 'bold',
			marginTop: spacing.xs,
			color: colors.text.primary,
		},
		distributionLabel: {
			fontSize: 16,
			fontWeight: '800',
			color: colors.text.primary,
			opacity: 0.75,
		},
		distributionPercentage: {
			fontSize: 16,
			fontWeight: '600',
			color: colors.text.secondary,
			marginTop: spacing.xs,
			marginLeft: spacing.xs,
		},
		overdueDays: {
			fontSize: 14,
			fontWeight: '500',
		},
		snoozed: {
			fontSize: 12,
			color: colors.warning,
			marginTop: spacing.xs,
		},
		insightItem: {
			flexDirection: 'row',
			alignItems: 'center',
			paddingVertical: spacing.md,
			borderBottomWidth: 1,
			borderBottomColor: colors.border,
		},
		insightLabel: {
			fontSize: 14,
			color: colors.text.secondary,
			marginLeft: spacing.md,
		},
		insightValue: {
			fontSize: 16,
			color: colors.text.primary,
			fontWeight: '600',
			marginLeft: spacing.sm,
		},
		densityChart: {
			flexDirection: 'row',
			alignItems: 'flex-end',
			height: 100,
			marginTop: spacing.md,
		},
		densityBarContainer: {
			flex: 1,
			alignItems: 'center',
		},
		densityBar: {
			width: 4,
			borderRadius: 2,
		},
		densityDate: {
			fontSize: 10,
			color: colors.text.secondary,
			marginTop: spacing.xs,
		},
		retryButton: {
			backgroundColor: colors.primary,
			padding: spacing.md,
			borderRadius: layout.borderRadius.sm,
			marginTop: spacing.md,
		},
		retryText: {
			color: colors.background.primary,
			fontSize: 16,
			fontWeight: '500',
			textAlign: 'center',
		},
		// Header Styles (should match the header styles in settings.js)
		screenHeader: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			paddingHorizontal: spacing.md,
			paddingTop: spacing.md,
			paddingBottom: spacing.sm,
		},
		headerBackButton: {
			padding: spacing.xs,
		},
		headerTitle: {
			fontSize: 20,
			fontWeight: '600',
			color: colors.text.primary,
		},
		headerRightPlaceholder: {
			width: spacing.xxl,
		},
	});
};
