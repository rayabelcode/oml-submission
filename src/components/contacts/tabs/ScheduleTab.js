import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useCommonStyles } from '../../../styles/common';
import { useStyles } from '../../../styles/screens/contacts';
import DatePickerModal from '../../modals/DatePickerModal';
import { updateContact } from '../../../utils/firestore';

const ScheduleTab = ({ contact, setSelectedContact }) => {
	const { colors } = useTheme();
	const styles = useStyles();

	const [showScheduleDatePicker, setShowScheduleDatePicker] = useState(false);
	const [selectedDate, setSelectedDate] = useState(
		contact?.next_contact ? new Date(contact.next_contact) : new Date()
	);

	return (
		<ScrollView style={styles.tabContent}>
			<View style={styles.scheduleContainer}>
				<Text style={styles.scheduleLabel}>Next Contact Date</Text>
				<Text style={styles.selectedDate}>
					{contact.next_contact ? new Date(contact.next_contact).toLocaleDateString() : 'Not Scheduled'}
				</Text>
			</View>

			<DatePickerModal
				visible={showScheduleDatePicker}
				onClose={() => setShowScheduleDatePicker(false)}
				selectedDate={selectedDate}
				onDateSelect={async (event, date) => {
					if (Platform.OS === 'web') {
						const newDate = new Date(event);
						newDate.setHours(12, 0, 0, 0);
						try {
							await updateContact(contact.id, {
								next_contact: newDate.toISOString(),
							});
							setSelectedContact({
								...contact,
								next_contact: newDate.toISOString(),
							});
							setSelectedDate(newDate);
							setShowScheduleDatePicker(false);
						} catch (error) {
							console.error('Error scheduling contact:', error);
							Alert.alert('Error', 'Failed to schedule contact');
						}
					} else if (date && event.type === 'set') {
						const newDate = new Date(date);
						newDate.setHours(12, 0, 0, 0);
						try {
							await updateContact(contact.id, {
								next_contact: newDate.toISOString(),
							});
							setSelectedContact({
								...contact,
								next_contact: newDate.toISOString(),
							});
							setSelectedDate(newDate);
							setShowScheduleDatePicker(false);
						} catch (error) {
							console.error('Error scheduling contact:', error);
							Alert.alert('Error', 'Failed to schedule contact');
						}
					}
				}}
			/>

			<View style={styles.scheduleActions}>
				<TouchableOpacity
					style={useCommonStyles().primaryButton}
					onPress={() => setShowScheduleDatePicker(true)}
				>
					<Text style={useCommonStyles().primaryButtonText}>Schedule Contact</Text>
				</TouchableOpacity>

				{contact.next_contact && (
					<TouchableOpacity
						style={styles.removeScheduleButton}
						onPress={async () => {
							try {
								await updateContact(contact.id, {
									next_contact: null,
								});
								setSelectedContact({
									...contact,
									next_contact: null,
								});
								setSelectedDate(new Date());
							} catch (error) {
								Alert.alert('Error', 'Failed to remove schedule');
							}
						}}
					>
						<Text style={styles.removeScheduleText}>Remove Schedule</Text>
					</TouchableOpacity>
				)}
			</View>
		</ScrollView>
	);
};

export default ScheduleTab;
