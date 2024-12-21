import React from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../styles/theme';
import commonStyles from '../../styles/common';

const AddReminderModal = ({ visible, onClose, reminderNote, setReminderNote, onSave }) => {
	return (
		<Modal visible={visible} transparent={true} animationType="fade">
			<View style={commonStyles.modalContainer}>
				<View style={commonStyles.modalContent}>
					<View style={commonStyles.modalHeader}>
						<Text style={commonStyles.modalTitle}>Add Reminder Note</Text>
						<TouchableOpacity onPress={onClose}>
							<Icon name="close-outline" size={24} color={colors.text.secondary} />
						</TouchableOpacity>
					</View>

					<TextInput
						style={[commonStyles.input, { height: 100, textAlignVertical: 'top' }]}
						multiline
						placeholder="Enter reminder note"
						value={reminderNote}
						onChangeText={setReminderNote}
					/>

					<TouchableOpacity style={commonStyles.primaryButton} onPress={onSave}>
						<Text style={commonStyles.primaryButtonText}>Save Reminder</Text>
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	);
};

export default AddReminderModal;
