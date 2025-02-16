import React from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { spacing, useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { DateTime } from 'luxon';

const DatePickerModal = ({ visible, onClose, selectedDate, onDateSelect, minimumDate, containerStyle }) => {
	const { colors, layout } = useTheme();

	const formatDate = (date) => {
		if (!date) return '';
		return DateTime.fromJSDate(date).toISODate();
	};

	const handleDayPress = (day) => {
		const newDate = DateTime.fromISO(day.dateString).toJSDate();
		onDateSelect({ type: 'set' }, newDate);
	};

	const renderArrow = (direction) => {
		const iconName = direction === 'left' ? 'chevron-back' : 'chevron-forward';
		return <Icon name={iconName} size={34} color={colors.primary} style={styles.arrow} />;
	};

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const styles = StyleSheet.create({
		modalHeader: {
			fontSize: 20,
			fontWeight: 'bold',
			color: colors.text.secondary,
			textAlign: 'center',
			marginBottom: spacing.xs,
		},
		datePickerModalOverlay: {
			flex: 1,
			backgroundColor: colors.background.overlay,
			justifyContent: 'center',
			alignItems: 'center',
		},
		datePickerContainer: {
			backgroundColor: colors.background.primary,
			borderRadius: layout.borderRadius.lg,
			paddingHorizontal: spacing.xs,
			paddingVertical: spacing.md,
			width: '90%',
			alignSelf: 'center',
			borderWidth: 3,
			borderColor: colors.border,
		},
		arrow: {
			padding: spacing.xs,
		},
	});

	return (
		<Modal visible={visible} transparent={true} animationType="fade">
			<TouchableOpacity style={styles.datePickerModalOverlay} onPress={onClose} activeOpacity={1}>
				<TouchableOpacity
					style={[styles.datePickerContainer, containerStyle]}
					activeOpacity={1}
					onPress={(e) => e.stopPropagation()}
				>
					<Calendar
						current={formatDate(selectedDate || today)}
						minDate={minimumDate ? formatDate(minimumDate) : undefined}
						onDayPress={handleDayPress}
						hideExtraDays={true}
						enableSwipeMonths={true}
						markedDates={{
							[formatDate(selectedDate)]: { selected: true, selectedColor: colors.primary },
						}}
						theme={{
							calendarBackground: colors.background.primary,
							dayTextColor: colors.text.primary,
							textDisabledColor: colors.text.subtleText,
							selectedDayBackgroundColor: colors.primary,
							selectedDayTextColor: '#ffffff',
							todayTextColor: colors.primary,
							arrowColor: colors.primary,
							monthTextColor: colors.text.primary,
							textDayFontSize: 18,
							textMonthFontSize: 18,
							textDayFontWeight: 'bold',
							textMonthFontWeight: 'bold',
							'stylesheet.calendar.header': {
								header: {
									flexDirection: 'row',
									justifyContent: 'space-between',
									alignItems: 'center',
									paddingLeft: 0,
									paddingRight: 0,
								},
								monthText: {
									fontSize: 18,
									fontWeight: 'bold',
									color: colors.text.primary,
								},
							},
						}}
						renderArrow={renderArrow}
						arrowsHitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
						disableMonthChange={true}
						style={{
							height: 380, // To fit 6 rows and padding
							paddingBottom: 1, // Make sure the bottom border is visible
						}}
					/>
				</TouchableOpacity>
			</TouchableOpacity>
		</Modal>
	);
};

export default DatePickerModal;
