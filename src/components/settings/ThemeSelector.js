import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const ThemeSelector = () => {
	const { theme, colors, spacing, layout, setThemeValue } = useTheme();

	const styles = StyleSheet.create({
		container: {
			flexDirection: 'row',
			backgroundColor: colors.background.secondary,
			borderRadius: layout.borderRadius.md,
			padding: spacing.sm,
			marginHorizontal: spacing.md,
			marginBottom: spacing.md,
		},
		segment: {
			flex: 1,
			paddingVertical: spacing.sm,
			alignItems: 'center',
			borderRadius: layout.borderRadius.sm,
		},
		activeSegment: {
			backgroundColor: colors.background.primary,
		},
		segmentText: {
			color: colors.text.secondary,
			fontSize: 14,
			fontWeight: '500',
		},
		activeText: {
			color: colors.primary,
			fontWeight: '600',
		},
	});

	const themeOptions = ['system', 'light', 'dimmed', 'dark'];

	const getDisplayText = (themeOption) => {
		if (themeOption === 'system') return 'System';
		return themeOption.charAt(0).toUpperCase() + themeOption.slice(1);
	};

	return (
		<View style={styles.container}>
			{themeOptions.map((themeOption) => (
				<TouchableOpacity
					key={themeOption}
					style={[styles.segment, theme === themeOption && styles.activeSegment]}
					onPress={() => setThemeValue(themeOption)}
				>
					<Text style={[styles.segmentText, theme === themeOption && styles.activeText]}>
						{getDisplayText(themeOption)}
					</Text>
				</TouchableOpacity>
			))}
		</View>
	);
};

export default ThemeSelector;
