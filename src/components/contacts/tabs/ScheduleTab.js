import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../../context/ThemeContext';
import { useScheduleStyles } from '../../../styles/contacts/scheduleStyle';
import { updateContactScheduling, updateNextContact } from '../../../utils/firestore';
import { SchedulingService } from '../../../utils/scheduler';
import TimePickerModal from '../../modals/TimePickerModal';
import DatePickerModal from '../../modals/DatePickerModal';

const FREQUENCY_OPTIONS = [
	{ label: 'Daily', value: 'daily' },
	{ label: 'Weekly', value: 'weekly' },
	{ label: 'Bi-weekly', value: 'biweekly' },
	{ label: 'Monthly', value: 'monthly' },
	{ label: 'Quarterly', value: 'quarterly' },
	{ label: 'Yearly', value: 'yearly' },
];

const PRIORITY_OPTIONS = [
	{ label: 'Low', value: 'low' },
	{ label: 'Normal', value: 'normal' },
	{ label: 'High', value: 'high' },
];

const DAYS_OF_WEEK = [
	{ label: 'M', value: 'monday' },
	{ label: 'T', value: 'tuesday' },
	{ label: 'W', value: 'wednesday' },
	{ label: 'T', value: 'thursday' },
	{ label: 'F', value: 'friday' },
	{ label: 'S', value: 'saturday' },
	{ label: 'S', value: 'sunday' },
];

const ScheduleTab = ({ contact, setSelectedContact, loadContacts }) => {
	const { colors, spacing } = useTheme();
	const styles = useScheduleStyles();

	// State management
	const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
	const [frequency, setFrequency] = useState(contact?.scheduling?.frequency || null);
	const [priority, setPriority] = useState(contact?.scheduling?.custom_preferences?.priority || 'normal');
	const [selectedDays, setSelectedDays] = useState(
		contact?.scheduling?.custom_preferences?.preferred_days || []
	);
	const [showStartTimePicker, setShowStartTimePicker] = useState(false);
	const [showEndTimePicker, setShowEndTimePicker] = useState(false);
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [activeHours, setActiveHours] = useState({
		start: contact?.scheduling?.custom_preferences?.active_hours?.start || '09:00',
		end: contact?.scheduling?.custom_preferences?.active_hours?.end || '17:00',
	});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);

	// Format time helpers
	const getHourFromTimeString = (timeString) => parseInt(timeString.split(':')[0]);
	const formatHourToTimeString = (hour) => `${hour.toString().padStart(2, '0')}:00`;
	const formatTimeForDisplay = (timeString) => {
		const hour = getHourFromTimeString(timeString);
		const period = hour >= 12 ? 'PM' : 'AM';
		const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
		return `${displayHour}:00 ${period}`;
	};

	// Handle scheduling updates
	const handleUpdateScheduling = async (updates, shouldSchedule = true) => {
		setError(null);
		setLoading(true);
		try {
			const updatedPreferences = {
				...contact?.scheduling?.custom_preferences,
				...updates,
			};

			await updateContactScheduling(contact.id, {
				...contact.scheduling,
				custom_schedule: true,
				custom_preferences: updatedPreferences,
			});

			if (shouldSchedule) {
				await handleScheduleContact();
			}

			setSelectedContact({
				...contact,
				scheduling: {
					...contact.scheduling,
					custom_schedule: true,
					custom_preferences: updatedPreferences,
				},
			});

			await loadContacts();
		} catch (error) {
			setError('Failed to update scheduling preferences');
			console.error('Error updating scheduling preferences:', error);
		} finally {
			setLoading(false);
		}
	};

	// Handle scheduling
	const handleScheduleContact = async (customDate = null) => {
		setLoading(true);
		setError(null);
		try {
			const scheduler = new SchedulingService(
				contact.scheduling?.custom_preferences,
				[],
				Intl.DateTimeFormat().resolvedOptions().timeZone
			);

			const lastContact = contact.last_contacted || new Date();
			let reminderDetails;

			if (customDate) {
				reminderDetails = await scheduler.scheduleCustomDate(contact, customDate);
			} else if (frequency) {
				reminderDetails = await scheduler.scheduleReminder(contact, lastContact, frequency);
			} else {
				throw new Error('No scheduling parameters provided');
			}

			const nextContactDate = new Date(reminderDetails.date.toDate());

			const updatedContact = {
				...contact,
				next_contact: nextContactDate.toISOString(),
				scheduling: {
					...contact.scheduling,
					frequency,
					custom_schedule: showAdvancedSettings,
				},
			};

			setSelectedContact(updatedContact);

			await updateContactScheduling(contact.id, {
				frequency,
				custom_schedule: showAdvancedSettings,
			});
			await updateNextContact(contact.id, nextContactDate);
		} catch (error) {
			setError('Failed to schedule contact');
			console.error('Error scheduling contact:', error);
		} finally {
			setLoading(false);
		}
	};

	// Handle recurring off
	const handleRecurringOff = async () => {
		setLoading(true);
		setError(null);
		try {
			setFrequency(null);
			await updateContactScheduling(contact.id, {
				...contact.scheduling,
				frequency: null,
			});
		} catch (error) {
			setError('Failed to turn off recurring schedule');
			console.error('Error turning off recurring schedule:', error);
		} finally {
			setLoading(false);
		}
	};

	return (
		<ScrollView
			style={styles.container}
			contentContainerStyle={{ paddingBottom: spacing.xl }}
			showsVerticalScrollIndicator={false}
		>
			{loading && (
				<View style={styles.loadingOverlay}>
					<ActivityIndicator size="large" color={colors.primary} />
				</View>
			)}

			{/* Frequency Grid */}
			<View style={styles.gridContainer}>
				<View style={styles.frequencyGrid}>
					{FREQUENCY_OPTIONS.map((option) => (
						<TouchableOpacity
							key={option.value}
							style={[
								styles.frequencyButton,
								frequency === option.value && styles.frequencyButtonActive,
								loading && styles.disabledButton,
							]}
							onPress={() => {
								setFrequency(option.value);
								handleUpdateScheduling({ frequency: option.value });
							}}
							disabled={loading}
						>
							<Text style={[styles.frequencyText, frequency === option.value && styles.frequencyTextActive]}>
								{option.label}
							</Text>
						</TouchableOpacity>
					))}
				</View>
			</View>

			{/* Action Buttons */}
			<View style={styles.actionButtonsContainer}>
				<TouchableOpacity
					style={[styles.customDateButton, loading && styles.disabledButton]}
					onPress={() => setShowDatePicker(true)}
					disabled={loading}
				>
					<Text style={styles.customDateText}>Add Custom Date</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={[styles.recurringOffButton, loading && styles.disabledButton]}
					onPress={handleRecurringOff}
					disabled={loading}
				>
					<Text style={styles.recurringOffText}>Recurring Off</Text>
				</TouchableOpacity>
			</View>

			{error && <Text style={styles.errorText}>{error}</Text>}

			{/* Advanced Settings */}
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
				<View>
					{/* Priority Section */}
					<View style={styles.priorityContainer}>
						<Text style={styles.sectionTitle}>Priority</Text>
						<View style={styles.priorityButtons}>
							{PRIORITY_OPTIONS.map((option) => (
								<TouchableOpacity
									key={option.value}
									style={[
										styles.priorityButton,
										priority === option.value && styles.priorityButtonActive,
										loading && styles.disabledButton,
									]}
									onPress={() => {
										setPriority(option.value);
										handleUpdateScheduling({ priority: option.value }, false);
									}}
									disabled={loading}
								>
									<Text style={[styles.priorityText, priority === option.value && styles.priorityTextActive]}>
										{option.label}
									</Text>
								</TouchableOpacity>
							))}
						</View>
					</View>

					{/* Preferred Days */}
					<View style={styles.daysContainer}>
						<Text style={styles.sectionTitle}>Preferred Days</Text>
						<View style={styles.daysGrid}>
							{DAYS_OF_WEEK.map((day) => {
								const isSelected = selectedDays.includes(day.value);
								return (
									<TouchableOpacity
										key={day.value}
										style={[
											styles.dayButton,
											isSelected && styles.dayButtonActive,
											loading && styles.disabledButton,
										]}
										onPress={() => {
											const updatedDays = isSelected
												? selectedDays.filter((d) => d !== day.value)
												: [...selectedDays, day.value];
											setSelectedDays(updatedDays);
											handleUpdateScheduling({ preferred_days: updatedDays }, false);
										}}
										disabled={loading}
									>
										<Text style={[styles.dayText, isSelected && styles.dayTextActive]}>{day.label}</Text>
									</TouchableOpacity>
								);
							})}
						</View>
					</View>

					{/* Active Hours */}
					<View style={styles.hoursContainer}>
						<Text style={styles.sectionTitle}>Active Hours</Text>
						<View style={styles.hoursRow}>
							<TouchableOpacity
								style={[styles.timeButton, loading && styles.disabledButton]}
								onPress={() => setShowStartTimePicker(true)}
								disabled={loading}
							>
								<Text style={styles.timeText}>Start: {formatTimeForDisplay(activeHours.start)}</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.timeButton, loading && styles.disabledButton]}
								onPress={() => setShowEndTimePicker(true)}
								disabled={loading}
							>
								<Text style={styles.timeText}>End: {formatTimeForDisplay(activeHours.end)}</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			)}

			{/* Next Contact Display */}
			{contact.next_contact && (
				<View style={styles.nextContactContainer}>
					<Text style={styles.nextContactLabel}>Next Contact</Text>
					<Text style={styles.nextContactDate}>{new Date(contact.next_contact).toLocaleDateString()}</Text>
				</View>
			)}

			{/* Modals */}
			<TimePickerModal
				visible={showStartTimePicker}
				onClose={() => setShowStartTimePicker(false)}
				initialHour={getHourFromTimeString(activeHours.start)}
				title="Select Start Time"
				onSelect={(hour) => {
					const newTime = formatHourToTimeString(hour);
					if (hour >= getHourFromTimeString(activeHours.end)) {
						setError('Start time must be before end time');
						return;
					}
					setActiveHours((prev) => ({ ...prev, start: newTime }));
					handleUpdateScheduling(
						{
							active_hours: { ...activeHours, start: newTime },
						},
						false
					);
					setShowStartTimePicker(false);
				}}
			/>

			<TimePickerModal
				visible={showEndTimePicker}
				onClose={() => setShowEndTimePicker(false)}
				initialHour={getHourFromTimeString(activeHours.end)}
				title="Select End Time"
				onSelect={(hour) => {
					const newTime = formatHourToTimeString(hour);
					if (hour <= getHourFromTimeString(activeHours.start)) {
						setError('End time must be after start time');
						return;
					}
					setActiveHours((prev) => ({ ...prev, end: newTime }));
					handleUpdateScheduling(
						{
							active_hours: { ...activeHours, end: newTime },
						},
						false
					);
					setShowEndTimePicker(false);
				}}
			/>

			<DatePickerModal
				visible={showDatePicker}
				selectedDate={new Date()}
				onClose={() => setShowDatePicker(false)}
				onDateSelect={(event, date) => {
					setShowDatePicker(false);
					if (date) {
						handleScheduleContact(date);
					}
				}}
			/>
		</ScrollView>
	);
};

export default ScheduleTab;
