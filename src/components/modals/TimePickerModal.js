import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Platform, Pressable } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTheme, spacing } from '../../context/ThemeContext';
import { useCommonStyles } from '../../styles/common';

const TimePickerModal = ({ visible, onClose, onSelect, initialHour = 9, title = 'Select Time' }) => {
    const { colors } = useTheme();
    const commonStyles = useCommonStyles();
    const [selectedHour, setSelectedHour] = useState(initialHour);

    const hours = Array.from({ length: 24 }, (_, i) => i);

    const formatHour = (hour) => {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${displayHour}:00 ${period}`;
    };

    const handleConfirm = () => {
        onSelect(selectedHour);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable 
                style={commonStyles.modalContainer} 
                onPress={onClose}
            >
                <Pressable 
                    style={[commonStyles.modalContent, { height: 300 }]}
                    onPress={e => e.stopPropagation()}
                >
                    <View style={commonStyles.modalHeader}>
                        <Text style={commonStyles.modalTitle}>{title}</Text>
                    </View>

                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <Picker
                            selectedValue={selectedHour}
                            onValueChange={(hour) => setSelectedHour(hour)}
                            itemStyle={{ 
                                height: 120,
                                fontSize: 20,
                                color: colors.text.primary
                            }}
                        >
                            {hours.map((hour) => (
                                <Picker.Item
                                    key={hour}
                                    label={formatHour(hour)}
                                    value={hour}
                                />
                            ))}
                        </Picker>
                    </View>

                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        paddingHorizontal: spacing.md,
                        paddingBottom: spacing.md
                    }}>
                        <TouchableOpacity
                            style={commonStyles.secondaryButton}
                            onPress={onClose}
                        >
                            <Text style={commonStyles.secondaryButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={commonStyles.primaryButton}
                            onPress={handleConfirm}
                        >
                            <Text style={commonStyles.primaryButtonText}>Confirm</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

export default TimePickerModal;
