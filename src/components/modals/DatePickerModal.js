import React from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { spacing, useTheme } from '../../context/ThemeContext';

const DatePickerModal = ({ visible, onClose, selectedDate, onDateSelect, minimumDate, containerStyle }) => {
	const { colors, layout, theme } = useTheme();

	const isToday = (date) => {
		const today = new Date();
		return (
			date.getDate() === today.getDate() &&
			date.getMonth() === today.getMonth() &&
			date.getFullYear() === today.getFullYear()
		);
	};

	const styles = StyleSheet.create({
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
		todayButton: {
			paddingVertical: spacing.md,
			paddingHorizontal: spacing.xl,
			alignItems: 'center',
			marginTop: spacing.sm,
			marginBottom: spacing.xs,
			backgroundColor: colors.primary,
			borderRadius: layout.borderRadius.md,
			alignSelf: 'center',
		},
		todayButtonText: {
			color: 'white',
			fontSize: 17,
			fontWeight: '600',
		},
	});

	const initialDate = selectedDate || new Date();

	return (
		<Modal visible={visible} transparent={true} animationType="fade">
			<TouchableOpacity style={styles.datePickerModalOverlay} onPress={onClose} activeOpacity={1}>
				<View style={[styles.datePickerContainer, containerStyle]}>
					<DateTimePicker
						value={initialDate}
						mode="date"
						display="inline"
						onChange={onDateSelect}
						minimumDate={minimumDate}
						textColor={colors.text.primary}
						accentColor={colors.primary}
						themeVariant={colors.theme}
					/>
					{isToday(initialDate) && (
						<TouchableOpacity
							style={styles.todayButton}
							onPress={() => onDateSelect({ type: 'set' }, new Date())}
						>
							<Text style={styles.todayButtonText}>Select Today</Text>
						</TouchableOpacity>
					)}
				</View>
			</TouchableOpacity>
		</Modal>
	);
};

export default DatePickerModal;
