// src/styles/screens/stats.js
import { StyleSheet } from 'react-native';
import { spacing, layout } from '../../context/ThemeContext';

export const useStyles = (colors) => {
	return StyleSheet.create({
		statsContainer: {
			flex: 1,
			padding: spacing.md,
			backgroundColor: colors.background.primary,
		},
		section: {
			marginBottom: spacing.xl,
			backgroundColor: colors.background.secondary,
			borderRadius: layout.borderRadius.md,
			padding: spacing.md,
		},
		sectionTitle: {
			fontSize: 18,
			fontWeight: 'bold',
			marginBottom: spacing.md,
			color: colors.text.primary,
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
			marginTop: spacing.xs,
			color: colors.text.secondary,
		},
		statValue: {
			fontSize: 24,
			fontWeight: 'bold',
			marginTop: spacing.xs,
			color: colors.text.primary,
		},
		relationshipRow: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			paddingVertical: spacing.sm,
			borderBottomWidth: 1,
			borderBottomColor: colors.border,
		},
		relationshipType: {
			fontSize: 16,
			color: colors.text.primary,
		},
		relationshipCount: {
			fontSize: 16,
			fontWeight: 'bold',
			color: colors.primary,
		},
		contactRow: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			paddingVertical: spacing.sm,
			borderBottomWidth: 1,
			borderBottomColor: colors.border,
		},
		contactName: {
			fontSize: 16,
			color: colors.text.primary,
		},
		lastContact: {
			fontSize: 14,
			color: colors.text.secondary,
		},
	});
};
