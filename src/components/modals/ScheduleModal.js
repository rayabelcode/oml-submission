import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../context/ThemeContext';
import { useCommonStyles } from '../../styles/common';
import { useStyles } from '../../styles/screens/contacts';
import { updateContact } from '../../utils/firestore';

const ScheduleModal = ({ visible, contact, onClose, onSubmit, setIsDetailsVisible, loadContacts }) => {
	const { colors } = useTheme();
	const commonStyles = useCommonStyles();
	const styles = useStyles();
	const [selectedDate, setSelectedDate] = useState(new Date());

	const handleConfirm = () => {
		onSubmit(selectedDate);
	};

	return (
		<Modal visible={visible} animationType="fade" transparent={true}>
			<View style={commonStyles.modalContainer}>
				<View style={commonStyles.modalContent}>
					<View style={commonStyles.modalHeader}>
						<Text style={commonStyles.modalTitle}>Schedule Contact</Text>
						<TouchableOpacity onPress={onClose}>
							<Icon name="close-outline" size={24} color={colors.text.secondary} />
						</TouchableOpacity>
					</View>

					<View style={styles.scheduleContainer}>
						<Text style={styles.scheduleLabel}>Next Contact Date</Text>
						<Text style={styles.selectedDate}>{selectedDate.toLocaleDateString()}</Text>
					</View>

					<DateTimePicker
						value={selectedDate}
						mode="date"
						display="inline"
						onChange={(event, date) => {
							if (date) {
								const newDate = new Date(date);
								newDate.setHours(12, 0, 0, 0);
								setSelectedDate(newDate);
							}
						}}
						textColor={colors.text.primary}
						accentColor={colors.primary}
						themeVariant="light"
					/>

					<TouchableOpacity style={commonStyles.primaryButton} onPress={handleConfirm}>
						<Text style={commonStyles.primaryButtonText}>Confirm</Text>
					</TouchableOpacity>

					<TouchableOpacity
						style={styles.removeScheduleButton}
						onPress={() => {
							Alert.alert('Remove Schedule', 'Are you sure you want to remove the next scheduled contact?', [
								{ text: 'Cancel', style: 'cancel' },
								{
									text: 'Remove',
									onPress: async () => {
										try {
											await updateContact(contact.id, {
												next_contact: null,
											});
											await loadContacts();
											onClose();
											setIsDetailsVisible(true);
										} catch (error) {
											Alert.alert('Error', 'Failed to remove schedule');
										}
									},
								},
							]);
						}}
					>
						<Text style={styles.removeScheduleText}>Remove Next Call</Text>
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	);
};

export default ScheduleModal;
