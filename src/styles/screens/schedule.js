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
		section: {
			paddingHorizontal: spacing.xs,
			marginBottom: spacing.xl,
		},
		groupHeader: {
			flexDirection: 'row',
			justifyContent: 'center',
			paddingTop: spacing.md,
			paddingBottom: spacing.lg,
		},
		groupTitle: {
			fontSize: 20,
			fontWeight: '700',
			color: colors.text.primary,
			textAlign: 'center',
		},
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
			marginBottom: spacing.md,
			marginHorizontal: spacing.xs,
			width: '47%',
			alignItems: 'center',
			justifyContent: 'center',
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
		upcomingContactDate: {
			fontSize: 16,
			fontWeight: '600',
			color: colors.text.secondary,
			marginTop: spacing.md,
			textAlign: 'center',
		},
	});
};

export { useStyles };
