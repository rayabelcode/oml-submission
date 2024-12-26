import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useCommonStyles } from '../../../styles/common';
import { useStyles } from '../../../styles/screens/contacts';
import DatePickerModal from '../../modals/DatePickerModal';
import { updateContact, updateContactScheduling, updateNextContact } from '../../../utils/firestore';
import { SchedulingService } from '../../../utils/scheduler';
import Icon from 'react-native-vector-icons/Ionicons';

const FREQUENCY_OPTIONS = [
	{ label: 'Daily', value: 'daily' },
	{ label: 'Weekly', value: 'weekly' },
	{ label: 'Bi-weekly', value: 'biweekly' },
	{ label: 'Monthly', value: 'monthly' },
	{ label: 'Quarterly', value: 'quarterly' },
	{ label: 'Yearly', value: 'yearly' },
];

const ScheduleTab = ({ contact, setSelectedContact }) => {
	const { colors } = useTheme();
	const styles = useStyles();
	const commonStyles = useCommonStyles();

	const [showScheduleDatePicker, setShowScheduleDatePicker] = useState(false);
	const [selectedDate, setSelectedDate] = useState(
		contact?.next_contact ? new Date(contact.next_contact) : new Date()
	);
	const [frequency, setFrequency] = useState(contact?.scheduling?.frequency || 'weekly');
	const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

	const handleFrequencyChange = async (newFrequency) => {
		try {
			await updateContactScheduling(contact.id, {
				frequency: newFrequency,
				custom_schedule: contact.scheduling?.custom_schedule || false,
			});
			setFrequency(newFrequency);
			setSelectedContact({
				...contact,
				scheduling: {
					frequency: newFrequency,
					custom_schedule: contact.scheduling?.custom_schedule || false,
				},
			});
		} catch (error) {
			console.error('Error updating frequency:', error);
			Alert.alert('Error', 'Failed to update contact frequency');
		}
	};

	const handleScheduleContact = async () => {
		try {
			// Get existing reminders for conflict checking
			const existingReminders = []; // TODO: Fetch from Firestore

			const scheduler = new SchedulingService(
				contact.scheduling?.custom_preferences,
				existingReminders,
				Intl.DateTimeFormat().resolvedOptions().timeZone
			);

			const lastContact = contact.last_contacted || new Date();
			const reminderDetails = await scheduler.scheduleReminder(contact, lastContact, frequency);

			await updateContactScheduling(contact.id, {
				frequency,
				custom_schedule: showAdvancedSettings,
			});

			await updateNextContact(contact.id, new Date(reminderDetails.date.toDate()));

			setSelectedContact({
				...contact,
				next_contact: reminderDetails.date.toDate().toISOString(),
				scheduling: {
					...contact.scheduling,
					frequency,
				},
			});

			Alert.alert('Success', 'Contact has been scheduled');
		} catch (error) {
			console.error('Error scheduling contact:', error);
			Alert.alert('Error', 'Failed to schedule contact');
		}
	};

	return (
		<ScrollView
			style={styles.tabContent}
			contentContainerStyle={styles.scrollContent}
			scrollEventThrottle={16}
			showsVerticalScrollIndicator={false}
		>
			<TouchableOpacity activeOpacity={1}>
				<View style={styles.scheduleContainer}>
					<Text style={styles.scheduleLabel}>Contact Frequency</Text>
					<View style={styles.frequencyPicker}>
						{FREQUENCY_OPTIONS.map((option) => (
							<TouchableOpacity
								key={option.value}
								style={[styles.frequencyOption, frequency === option.value && styles.frequencyOptionSelected]}
								onPress={() => handleFrequencyChange(option.value)}
							>
								<Text
									style={[styles.frequencyText, frequency === option.value && styles.frequencyTextSelected]}
								>
									{option.label}
								</Text>
							</TouchableOpacity>
						))}
					</View>

					<TouchableOpacity
						style={styles.advancedSettingsButton}
						onPress={() => setShowAdvancedSettings(!showAdvancedSettings)}
					>
						<Icon
							name={showAdvancedSettings ? 'chevron-up' : 'chevron-down'}
							size={24}
							color={colors.text.secondary}
						/>
						<Text style={styles.advancedSettingsText}>Advanced Settings</Text>
					</TouchableOpacity>

					{showAdvancedSettings && (
						<TouchableOpacity activeOpacity={1}>
							<View style={styles.advancedSettings}>
								{/* Advanced settings UI to be implemented */}
								<Text style={styles.settingsNote}>Advanced scheduling options coming soon...</Text>
							</View>
						</TouchableOpacity>
					)}

					{contact.next_contact && (
						<TouchableOpacity activeOpacity={1}>
							<View style={styles.nextContactContainer}>
								<Text style={styles.nextContactLabel}>Next Contact</Text>
								<Text style={styles.nextContactDate}>
									{new Date(contact.next_contact).toLocaleDateString()}
								</Text>
							</View>
						</TouchableOpacity>
					)}

					<TouchableOpacity
						style={[commonStyles.primaryButton, { marginTop: 20 }]}
						onPress={handleScheduleContact}
					>
						<Text style={commonStyles.primaryButtonText}>Schedule Contact</Text>
					</TouchableOpacity>

					{contact.next_contact && (
						<TouchableOpacity
							style={styles.removeScheduleButton}
							onPress={() => {
								Alert.alert('Remove Schedule', 'Are you sure you want to remove this schedule?', [
									{ text: 'Cancel', style: 'cancel' },
									{
										text: 'Remove',
										style: 'destructive',
										onPress: async () => {
											try {
												await updateNextContact(contact.id, null);
												setSelectedContact({
													...contact,
													next_contact: null,
												});
											} catch (error) {
												Alert.alert('Error', 'Failed to remove schedule');
											}
										},
									},
								]);
							}}
						>
							<Text style={styles.removeScheduleText}>Remove Schedule</Text>
						</TouchableOpacity>
					)}
				</View>
			</TouchableOpacity>
		</ScrollView>
	);
};

export default ScheduleTab;
