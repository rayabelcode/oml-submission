import React from 'react';
import { Modal, View, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../context/ThemeContext';

const DatePickerModal = ({ visible, onClose, selectedDate, onDateSelect, containerStyle }) => {
	const { colors, theme } = useTheme();

	const styles = StyleSheet.create({
		datePickerModalOverlay: {
			flex: 1,
			backgroundColor: colors.background.overlay,
			justifyContent: 'center',
			alignItems: 'center',
		},
		datePickerContainer: {
			backgroundColor: colors.background.primary,
			borderRadius: 15,
			padding: 15,
			width: '85%',
			alignSelf: 'center',
		},
	});

	return (
		<Modal visible={visible} transparent={true} animationType="fade">
			<TouchableOpacity style={styles.datePickerModalOverlay} onPress={onClose} activeOpacity={1}>
				<View style={[styles.datePickerContainer, containerStyle]}>
					<DateTimePicker
						value={selectedDate}
						mode="date"
						display="inline"
						onChange={onDateSelect}
						textColor={colors.text.primary}
						accentColor={colors.primary}
						themeVariant={theme}
					/>
				</View>
			</TouchableOpacity>
		</Modal>
	);
};

export default DatePickerModal;
