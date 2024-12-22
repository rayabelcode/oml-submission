import React from 'react';
import { Modal, View, TouchableOpacity, Platform } from 'react-native';
import DatePicker from 'react-datepicker';
import '../../../assets/css/react-datepicker.css';
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../context/ThemeContext';
import { useCommonStyles } from '../../styles/common';

// Update component
const DatePickerModal = ({ visible, onClose, selectedDate, onDateSelect, containerStyle }) => {
	const { colors } = useTheme();
	const commonStyles = useCommonStyles();
	return (
		<Modal visible={visible} transparent={true} animationType="fade">
			<TouchableOpacity style={commonStyles.modalContainer} onPress={onClose} activeOpacity={1}>
				<View style={[commonStyles.modalContent, containerStyle]} onClick={(e) => e.stopPropagation()}>
					{Platform.OS === 'web' ? (
						<DatePicker
							selected={selectedDate}
							onChange={onDateSelect}
							inline
							dateFormat="MM/dd/yyyy"
							renderCustomHeader={({
								date,
								decreaseMonth,
								increaseMonth,
								prevMonthButtonDisabled,
								nextMonthButtonDisabled,
							}) => (
								<div
									style={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center',
										padding: '10px',
									}}
								>
									<button
										onClick={decreaseMonth}
										disabled={prevMonthButtonDisabled}
										style={{
											border: 'none',
											background: 'none',
											cursor: 'pointer',
										}}
									>
										<Icon
											name="chevron-back-outline"
											size={24}
											color={prevMonthButtonDisabled ? '#ccc' : colors.primary}
										/>
									</button>
									<span style={{ fontWeight: '500', fontSize: '16px' }}>
										{date.toLocaleString('default', { month: 'long', year: 'numeric' })}
									</span>
									<button
										onClick={increaseMonth}
										disabled={nextMonthButtonDisabled}
										style={{
											border: 'none',
											background: 'none',
											cursor: 'pointer',
										}}
									>
										<Icon
											name="chevron-forward-outline"
											size={24}
											color={nextMonthButtonDisabled ? '#ccc' : colors.primary}
										/>
									</button>
								</div>
							)}
						/>
					) : (
						<DateTimePicker
							value={selectedDate}
							mode="date"
							display="inline"
							onChange={onDateSelect}
							textColor={colors.text.primary}
							accentColor={colors.primary}
							themeVariant="light"
						/>
					)}
				</View>
			</TouchableOpacity>
		</Modal>
	);
};

export default DatePickerModal;
