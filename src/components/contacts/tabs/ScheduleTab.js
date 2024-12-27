import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useTheme, spacing } from '../../../context/ThemeContext';
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
	const [selectedDays, setSelectedDays] = useState(
		contact?.scheduling?.custom_preferences?.preferred_days || []
	);

	// Ensure selectedDays is updated every time contact changes
	useEffect(() => {
		setSelectedDays(contact?.scheduling?.custom_preferences?.preferred_days || []);
	}, [contact]);

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
						<View style={styles.advancedSettings}>
							<Text style={[styles.sectionTitle, { marginBottom: spacing.md }]}>Preferred Days</Text>
							<View style={styles.frequencyPicker}>
								{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
									const isSelected = selectedDays.includes(day.toLowerCase());
									return (
										<TouchableOpacity
											key={day}
											style={[styles.frequencyOption, isSelected && styles.frequencyOptionSelected]}
											onPress={async () => {
												try {
													const updatedDays = isSelected
														? selectedDays.filter((d) => d !== day.toLowerCase())
														: [...selectedDays, day.toLowerCase()];

													setSelectedDays(updatedDays);

													await updateContactScheduling(contact.id, {
														...contact.scheduling,
														custom_schedule: true,
														custom_preferences: {
															...(contact?.scheduling?.custom_preferences || {}),
															preferred_days: updatedDays,
														},
													});

													setSelectedContact({
														...contact,
														scheduling: {
															...(contact.scheduling || {}),
															custom_schedule: true,
															custom_preferences: {
																...(contact?.scheduling?.custom_preferences || {}),
																preferred_days: updatedDays,
															},
														},
													});
												} catch (error) {
													console.error('Error updating preferred days:', error);
													Alert.alert('Error', 'Failed to update preferred days');
													setSelectedDays(contact?.scheduling?.custom_preferences?.preferred_days || []);
												}
											}}
										>
											<Text style={[styles.frequencyText, isSelected && styles.frequencyTextSelected]}>
												{day.substring(0, 3)}
											</Text>
										</TouchableOpacity>
									);
								})}
							</View>

							<Text style={[styles.sectionTitle, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
								Active Hours
							</Text>
							<View
								style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}
							>
								<TouchableOpacity
									style={[styles.frequencyOption, { flex: 1, marginRight: spacing.sm }]}
									onPress={() => {
										Alert.alert('Coming Soon', 'Time picker will be added in the next update');
									}}
								>
									<Text style={styles.frequencyText}>
										Start: {contact?.scheduling?.custom_preferences?.active_hours?.start || '09:00'}
									</Text>
								</TouchableOpacity>
								<TouchableOpacity
									style={[styles.frequencyOption, { flex: 1 }]}
									onPress={() => {
										Alert.alert('Coming Soon', 'Time picker will be added in the next update');
									}}
								>
									<Text style={styles.frequencyText}>
										End: {contact?.scheduling?.custom_preferences?.active_hours?.end || '17:00'}
									</Text>
								</TouchableOpacity>
							</View>

							<Text style={[styles.sectionTitle, { marginTop: spacing.md, marginBottom: spacing.sm }]}>
								Schedule Settings
							</Text>
							<View style={styles.settingRow}>
								<Text style={styles.scheduleLabel}>Minimum Gap Between Calls</Text>
								<TouchableOpacity
									style={[styles.frequencyOption]}
									onPress={() => {
										Alert.alert('Coming Soon', 'Gap adjustment will be added in the next update');
									}}
								>
									<Text style={styles.frequencyText}>{contact?.scheduling?.minimum_gap || 30} minutes</Text>
								</TouchableOpacity>
							</View>

							<TouchableOpacity
								style={[styles.advancedSettingsButton, { marginTop: spacing.lg }]}
								onPress={() => {
									Alert.alert(
										'Reset Preferences',
										'Are you sure you want to reset scheduling preferences to default?',
										[
											{ text: 'Cancel', style: 'cancel' },
											{
												text: 'Reset',
												style: 'destructive',
												onPress: async () => {
													try {
														await updateContactScheduling(contact.id, {
															frequency,
															custom_schedule: false,
															custom_preferences: null,
														});
														setSelectedDays([]);
														setSelectedContact({
															...contact,
															scheduling: {
																frequency,
																custom_schedule: false,
																custom_preferences: null,
															},
														});
													} catch (error) {
														console.error('Error resetting preferences:', error);
														Alert.alert('Error', 'Failed to reset preferences');
													}
												},
											},
										]
									);
								}}
							>
								<Icon name="refresh-outline" size={20} color={colors.text.secondary} />
								<Text style={styles.advancedSettingsText}>Reset to Default</Text>
							</TouchableOpacity>
						</View>
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
