import { StyleSheet, Platform } from 'react-native';
import { spacing, layout, useTheme } from '../../context/ThemeContext';

export const useContactDetailsStyles = () => {
	const { colors, theme, effectiveTheme } = useTheme();

	return StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: colors.background.primary,
		},
		headerContainer: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			paddingHorizontal: spacing.md,
			paddingVertical: spacing.md,
			backgroundColor: colors.background.primary,
			borderBottomWidth: 1,
			borderBottomColor: colors.border,
		},
		headerButton: {
			width: 44,
			height: 44,
			justifyContent: 'center',
			alignItems: 'center',
		},
		headerTitle: {
			fontSize: 20,
			fontWeight: '600',
			flex: 1,
			textAlign: 'center',
			marginHorizontal: spacing.md,
			color: colors.text.primary,
		},
		phoneButton: {
			width: 44,
			height: 44,
			borderRadius: 22,
			backgroundColor: colors.secondary,
			justifyContent: 'center',
			alignItems: 'center',
		},
		content: {
			flex: 1,
			backgroundColor: colors.background.primary,
		},
		callIconButton: {
			position: 'absolute',
			left: -18,
			top: -18,
			width: 50,
			height: 50,
			borderRadius: 50,
			backgroundColor: '#65D36E',
			borderWidth: 2,
			borderColor: colors.background.primary,
			alignItems: 'center',
			justifyContent: 'center',
			zIndex: 5,
		},
		aiIconButton: {
			position: 'absolute',
			right: -18,
			top: -18,
			width: 50,
			height: 50,
			borderRadius: 50,
			backgroundColor: colors.primary,
			borderWidth: 2,
			borderColor: colors.background.primary,
			alignItems: 'center',
			justifyContent: 'center',
			zIndex: 5,
		},
		contentContainer: {
			flex: 1,
			marginBottom: 65,
		},
		segmentedControlContainer: {
			position: 'absolute',
			bottom: 0,
			left: 0,
			right: 0,
			paddingHorizontal: spacing.sm,
			paddingBottom: Platform.OS === 'ios' ? 34 : 24,
			backgroundColor: 'transparent',
		},
		segmentedWrapper: {
			flexDirection: 'row',
			backgroundColor: colors.background.primary,
			borderRadius: layout.borderRadius.xxl,
			borderWidth: 1,
			borderColor: colors.border,
			height: 50,
			overflow: 'hidden',
		},
		segment: {
			flex: 1,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			gap: spacing.xs,
		},
		selectedSegment: {
			backgroundColor: colors.background.primary,
		},
		errorContainer: {
			flex: 1,
			justifyContent: 'center',
			alignItems: 'center',
			padding: spacing.lg,
		},
		errorText: {
			color: colors.danger,
			marginBottom: spacing.md,
			textAlign: 'center',
		},
		retryButton: {
			backgroundColor: colors.primary,
			paddingHorizontal: spacing.lg,
			paddingVertical: spacing.sm,
			borderRadius: layout.borderRadius.md,
		},
		retryButtonText: {
			color: colors.text.white,
			fontWeight: '600',
		},
	});
};
