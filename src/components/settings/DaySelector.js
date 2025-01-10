import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const DAYS = [
	{ key: 'sunday', label: 'S' },
	{ key: 'monday', label: 'M' },
	{ key: 'tuesday', label: 'T' },
	{ key: 'wednesday', label: 'W' },
	{ key: 'thursday', label: 'T' },
	{ key: 'friday', label: 'F' },
	{ key: 'saturday', label: 'S' },
];

const DaySelector = ({ selectedDays, onDayPress, disabled }) => {
	const { colors, spacing, layout } = useTheme();

	return (
		<View
			style={{
				flexDirection: 'row',
				justifyContent: 'space-between',
				paddingHorizontal: spacing.xs,
			}}
		>
			{DAYS.map((day) => {
				const isSelected = selectedDays.includes(day.key);
				return (
					<TouchableOpacity
						key={day.key}
						onPress={() => onDayPress(day.key)}
						disabled={disabled}
						style={{
							width: 36,
							height: 36,
							borderRadius: 18,
							backgroundColor: isSelected ? colors.primary : colors.background.secondary,
							alignItems: 'center',
							justifyContent: 'center',
							borderWidth: 1,
							borderColor: isSelected ? colors.primary : colors.border,
							opacity: disabled ? 0.5 : 1,
						}}
					>
						<Text
							style={{
								fontSize: 13,
								color: isSelected ? colors.background.primary : colors.text.primary,
								fontWeight: isSelected ? '500' : 'normal',
							}}
						>
							{day.label}
						</Text>
					</TouchableOpacity>
				);
			})}
		</View>
	);
};

export default DaySelector;
