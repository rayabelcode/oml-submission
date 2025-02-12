import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';

const TimeRangeSelector = ({
	startTime,
	endTime,
	onStartTimePress,
	onEndTimePress,
	label,
	error,
	disabled,
}) => {
	const { colors, spacing, layout } = useTheme();

	const formatTimeForDisplay = (timeString) => {
		const [hours] = timeString.split(':').map(Number);
		const period = hours >= 12 ? 'PM' : 'AM';
		const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
		return `${displayHour} ${period}`;
	};

	const timeButtonStyle = {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: colors.background.secondary,
		padding: spacing.md,
		borderRadius: layout.borderRadius.md,
		borderWidth: 1,
		borderColor: colors.border,
		opacity: disabled ? 0.5 : 1,
	};

	const timeLabelStyle = {
		fontSize: 12,
		color: colors.text.secondary,
	};

	const timeValueStyle = {
		fontSize: 16,
		color: colors.text.primary,
		fontWeight: '500',
	};

	return (
		<View style={{ marginBottom: spacing.md }}>
			{label && (
				<Text
					style={{
						fontSize: 16,
						fontWeight: '600',
						color: colors.text.primary,
						marginBottom: spacing.sm,
					}}
				>
					{label}
				</Text>
			)}

			<View
				style={{
					flexDirection: 'row',
					gap: spacing.sm,
				}}
			>
				<TouchableOpacity style={timeButtonStyle} onPress={onStartTimePress} disabled={disabled}>
					<Icon name="time-outline" size={24} color={colors.text.secondary} />
					<View style={{ flex: 1, marginLeft: spacing.sm }}>
						<Text style={timeLabelStyle}>Start</Text>
						<Text style={timeValueStyle}>{formatTimeForDisplay(startTime)}</Text>
					</View>
					<Icon name="chevron-forward-outline" size={24} color={colors.text.secondary} />
				</TouchableOpacity>

				<TouchableOpacity style={timeButtonStyle} onPress={onEndTimePress} disabled={disabled}>
					<Icon name="time-outline" size={24} color={colors.text.secondary} />
					<View style={{ flex: 1, marginLeft: spacing.sm }}>
						<Text style={timeLabelStyle}>End</Text>
						<Text style={timeValueStyle}>{formatTimeForDisplay(endTime)}</Text>
					</View>
					<Icon name="chevron-forward-outline" size={24} color={colors.text.secondary} />
				</TouchableOpacity>
			</View>

			{error && (
				<Text
					style={{
						fontSize: 14,
						color: colors.danger,
						marginTop: spacing.xs,
					}}
				>
					{error}
				</Text>
			)}
		</View>
	);
};

export default TimeRangeSelector;
