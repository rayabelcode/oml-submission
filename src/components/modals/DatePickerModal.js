import React from 'react';
import { Modal, View, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import DatePicker from 'react-datepicker';
import '../../styles/css/react-datepicker.css';
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
            width: Platform.OS === 'web' ? '50%' : '85%',
            alignSelf: 'center',
        },
    });

    return (
        <Modal visible={visible} transparent={true} animationType="fade">
            <TouchableOpacity style={styles.datePickerModalOverlay} onPress={onClose} activeOpacity={1}>
                <View style={[styles.datePickerContainer, containerStyle]} onClick={(e) => e.stopPropagation()}>
                    {Platform.OS === 'web' ? (
                        <div className={theme === 'dark' ? 'calendar-dark' : ''}>
                            <DatePicker
                                selected={selectedDate}
                                onChange={onDateSelect}
                                inline
                                dateFormat="MM/dd/yyyy"
                                wrapperClassName={theme === 'dark' ? 'calendar-dark' : ''}
                                calendarClassName={theme === 'dark' ? 'calendar-dark' : ''}
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
                                        <span style={{ 
                                            fontWeight: '500', 
                                            fontSize: '16px',
                                            color: colors.text.primary 
                                        }}>
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
                        </div>
                    ) : (
                        <DateTimePicker
                            value={selectedDate}
                            mode="date"
                            display="inline"
                            onChange={onDateSelect}
                            textColor={colors.text.primary}
                            accentColor={colors.primary}
                            themeVariant={theme}
                        />
                    )}
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

export default DatePickerModal;
