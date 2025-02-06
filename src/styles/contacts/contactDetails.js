import { StyleSheet, Platform } from 'react-native';
import { spacing, layout, useTheme } from '../../context/ThemeContext';

export const useContactDetailsStyles = () => {
	const { colors, theme } = useTheme();

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
	});
};
