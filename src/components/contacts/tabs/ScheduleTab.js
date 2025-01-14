import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../../context/ThemeContext';
import { useScheduleStyles } from '../../../styles/contacts/scheduleStyle';
import { updateContactScheduling, updateNextContact } from '../../../utils/firestore';
import { SchedulingService } from '../../../utils/scheduler';
import TimePickerModal from '../../modals/TimePickerModal';
import DatePickerModal from '../../modals/DatePickerModal';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../../config/firebase';

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
	const [priority, setPriority] = useState(contact?.scheduling?.priority || 'normal');
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
			let schedulingUpdate = {
				custom_schedule: true,
			};

			// Handle frequency and priority updates at root level
			if (updates.frequency) {
				schedulingUpdate.frequency = updates.frequency;
			}
			if (updates.priority) {
				schedulingUpdate.priority = updates.priority;
			}
			// Handle custom preference updates
			else if (!updates.frequency) {
				schedulingUpdate.custom_preferences = {
					...contact.scheduling?.custom_preferences,
					...updates,
				};
			}

			await updateContactScheduling(contact.id, schedulingUpdate);

			if (shouldSchedule) {
				await handleScheduleContact(null, schedulingUpdate);
			}

			setSelectedContact({
				...contact,
				scheduling: {
					...contact.scheduling,
					...schedulingUpdate,
				},
			});
		} catch (error) {
			setError('Failed to update scheduling preferences');
			console.error('Error updating scheduling preferences:', error);
		} finally {
			setLoading(false);
		}
	};

	// Handle scheduling
	const handleScheduleContact = async (customDate = null, schedulingData = null) => {
		try {
			const scheduler = new SchedulingService(
				contact.scheduling.custom_preferences,
				[],
				Intl.DateTimeFormat().resolvedOptions().timeZone
			);

			let reminderDetails;
			if (customDate) {
				reminderDetails = await scheduler.scheduleCustomDate({ ...contact }, customDate);
			} else if (contact.scheduling?.frequency) {
				reminderDetails = await scheduler.scheduleReminder(
					{ ...contact },
					contact.last_contacted || new Date(),
					contact.scheduling.frequency
				);
			} else {
				throw new Error('No scheduling parameters provided');
			}

			const nextContactDate = new Date(reminderDetails.date.toDate());
			await updateNextContact(contact.id, nextContactDate);

			// Update UI immediately
			setSelectedContact((prev) => ({
				...prev,
				next_contact: nextContactDate.toISOString(),
			}));
		} catch (error) {
			setError('Failed to schedule contact');
			console.error('Error scheduling contact:', error);
		}
	};

	// Handle recurring off
	const handleRecurringOff = async () => {
		try {
			setFrequency(null);
			const schedulingUpdate = {
				frequency: null,
			};
			await updateContactScheduling(contact.id, schedulingUpdate);
			setSelectedContact((prev) => ({
				...prev,
				scheduling: {
					...prev.scheduling,
					frequency: null,
				},
			}));
		} catch (error) {
			console.error('Error turning off recurring:', error);
			setError('Failed to turn off recurring');
			// Revert on failure
			setFrequency(contact?.scheduling?.frequency || null);
		}
	};

	return (
		<ScrollView
			style={styles.container}
			contentContainerStyle={{ paddingBottom: spacing.xl }}
			showsVerticalScrollIndicator={false}
		>
			{/* Next Contact Display */}
			{contact.next_contact && (
				<View style={styles.nextContactContainer}>
					<Text style={styles.nextContactLabel}>Next Contact</Text>
					<Text style={styles.nextContactDate}>{new Date(contact.next_contact).toLocaleDateString()}</Text>
				</View>
			)}

			{/* Frequency Grid */}
			<View style={styles.gridContainer}>
				<Text style={styles.sectionTitle}>Contact Frequency</Text>
				<View style={styles.frequencyGrid}>
					{FREQUENCY_OPTIONS.map((option) => (
						<TouchableOpacity
							key={option.value}
							style={[styles.frequencyButton, frequency === option.value && styles.frequencyButtonActive]}
							onPress={async () => {
								if (loading) return; // Prevent multiple clicks
								try {
									setLoading(true); // No UI change
									setFrequency(option.value);

									// Create scheduling update
									const schedulingUpdate = {
										frequency: option.value,
									};

									// Update scheduling preferences
									await updateContactScheduling(contact.id, schedulingUpdate);

									// Calculate next contact date using scheduler
									const scheduler = new SchedulingService(
										contact.scheduling?.custom_preferences,
										[],
										Intl.DateTimeFormat().resolvedOptions().timeZone
									);

									const lastContactDate = contact.last_contacted || new Date();
									const reminderDetails = await scheduler.scheduleReminder(
										{ ...contact },
										lastContactDate,
										option.value
									);

									const nextContactDate = reminderDetails.date.toDate();

									// Update next_contact date in Firestore
									await updateNextContact(contact.id, nextContactDate);

									// Update local state immediately
									setSelectedContact({
										...contact,
										scheduling: {
											...contact.scheduling,
											frequency: option.value,
										},
										next_contact: nextContactDate.toISOString(),
									});
								} catch (error) {
									console.error('Error updating frequency:', error);
									setFrequency(contact?.scheduling?.frequency || null);
									setError('Failed to update frequency');
								} finally {
									setLoading(false);
								}
							}}
							disabled={loading} // Visually show it's disabled
						>
							<Text
								style={[
									styles.frequencyText,
									frequency === option.value && styles.frequencyTextActive,
									loading && styles.disabledText,
								]}
							>
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
					<Text style={styles.customDateText}>Set Custom Date</Text>
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
									style={[styles.priorityButton, priority === option.value && styles.priorityButtonActive]}
									onPress={async () => {
										try {
											setPriority(option.value);
											const schedulingUpdate = {
												priority: option.value,
											};
											await updateContactScheduling(contact.id, schedulingUpdate);
											setSelectedContact((prev) => ({
												...prev,
												scheduling: {
													...prev.scheduling,
													priority: option.value,
												},
											}));
										} catch (error) {
											console.error('Error updating priority:', error);
											setError('Failed to update priority');
											// Revert on failure
											setPriority(contact?.scheduling?.priority || 'normal');
										}
									}}
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
										style={[styles.dayButton, isSelected && styles.dayButtonActive]}
										onPress={async () => {
											const updatedDays = isSelected
												? selectedDays.filter((d) => d !== day.value)
												: [...selectedDays, day.value];
											try {
												setSelectedDays(updatedDays);
												const schedulingUpdate = {
													custom_preferences: {
														...contact.scheduling?.custom_preferences,
														preferred_days: updatedDays,
													},
												};
												await updateContactScheduling(contact.id, schedulingUpdate);
												setSelectedContact((prev) => ({
													...prev,
													scheduling: {
														...prev.scheduling,
														custom_preferences: {
															...prev.scheduling?.custom_preferences,
															preferred_days: updatedDays,
														},
													},
												}));
											} catch (error) {
												console.error('Error updating preferred days:', error);
												setError('Failed to update preferred days');
												setSelectedDays(contact?.scheduling?.custom_preferences?.preferred_days || []);
											}
										}}
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

			{/* Modals */}
			{/* Start Time */}
			<TimePickerModal
				visible={showStartTimePicker}
				onClose={() => setShowStartTimePicker(false)}
				initialHour={getHourFromTimeString(activeHours.start)}
				title="Earliest Call Time"
				onSelect={async (hour) => {
					const newTime = formatHourToTimeString(hour);
					const endHour = getHourFromTimeString(activeHours.end);

					if (hour >= endHour) {
						Alert.alert('Invalid Time', 'Start time must be before end time', [{ text: 'OK' }]);
						return;
					}

					try {
						setActiveHours((prev) => ({ ...prev, start: newTime }));
						const schedulingUpdate = {
							'scheduling.custom_preferences.active_hours': {
								start: newTime,
								end: activeHours.end,
							},
						};
						await updateDoc(doc(db, 'contacts', contact.id), schedulingUpdate);
						setSelectedContact((prev) => ({
							...prev,
							scheduling: {
								...prev.scheduling,
								custom_preferences: {
									...prev.scheduling?.custom_preferences,
									active_hours: {
										...prev.scheduling?.custom_preferences?.active_hours,
										start: newTime,
										end: activeHours.end,
									},
								},
							},
						}));
					} catch (error) {
						console.error('Error updating start time:', error);
						setError('Failed to update start time');
					} finally {
						setShowStartTimePicker(false);
					}
				}}
			/>

			{/* End Time */}
			<TimePickerModal
				visible={showEndTimePicker}
				onClose={() => setShowEndTimePicker(false)}
				initialHour={getHourFromTimeString(activeHours.end)}
				title="Latest Call Time"
				onSelect={async (hour) => {
					const newTime = formatHourToTimeString(hour);
					const startHour = getHourFromTimeString(activeHours.start);

					if (hour <= startHour) {
						Alert.alert('Invalid Time', 'End time must be after start time', [{ text: 'OK' }]);
						return;
					}

					try {
						setActiveHours((prev) => ({ ...prev, end: newTime }));
						const schedulingUpdate = {
							'scheduling.custom_preferences.active_hours': {
								start: activeHours.start,
								end: newTime,
							},
						};
						await updateDoc(doc(db, 'contacts', contact.id), schedulingUpdate);
						setSelectedContact((prev) => ({
							...prev,
							scheduling: {
								...prev.scheduling,
								custom_preferences: {
									...prev.scheduling?.custom_preferences,
									active_hours: {
										...prev.scheduling?.custom_preferences?.active_hours,
										start: activeHours.start,
										end: newTime,
									},
								},
							},
						}));
					} catch (error) {
						console.error('Error updating end time:', error);
						setError('Failed to update end time');
					} finally {
						setShowEndTimePicker(false);
					}
				}}
			/>

			{/* End Time */}
			<TimePickerModal
				visible={showEndTimePicker}
				onClose={() => setShowEndTimePicker(false)}
				initialHour={getHourFromTimeString(activeHours.end)}
				title="Latest Call Time"
				onSelect={async (hour) => {
					const newTime = formatHourToTimeString(hour);
					const startHour = getHourFromTimeString(activeHours.start);

					if (hour <= startHour) {
						Alert.alert('Invalid Time', 'End time must be after start time', [{ text: 'OK' }]);
						return;
					}

					try {
						setActiveHours((prev) => ({ ...prev, end: newTime }));
						const schedulingUpdate = {
							custom_preferences: {
								...contact.scheduling?.custom_preferences,
								active_hours: {
									...contact.scheduling?.custom_preferences?.active_hours,
									start: activeHours.start,
									end: newTime,
								},
							},
						};
						await updateContactScheduling(contact.id, schedulingUpdate);
						setSelectedContact((prev) => ({
							...prev,
							scheduling: {
								...prev.scheduling,
								custom_preferences: {
									...prev.scheduling?.custom_preferences,
									active_hours: {
										...prev.scheduling?.custom_preferences?.active_hours,
										start: activeHours.start,
										end: newTime,
									},
								},
							},
						}));
					} catch (error) {
						console.error('Error updating end time:', error);
						setError('Failed to update end time');
					} finally {
						setShowEndTimePicker(false);
					}
				}}
			/>
			<DatePickerModal
				visible={showDatePicker}
				selectedDate={contact.next_contact ? new Date(contact.next_contact) : new Date()}
				onClose={() => setShowDatePicker(false)}
				onDateSelect={async (event, date) => {
					if (!date) return;

					try {
						setShowDatePicker(false);

						// Update Firebase
						await updateNextContact(contact.id, date);

						// Update local state with same date
						setSelectedContact({
							...contact,
							next_contact: date.toISOString(),
						});

						// Force reload all contacts
						if (loadContacts) {
							await loadContacts();
						}
					} catch (error) {
						console.error('Error updating next contact:', error);
						Alert.alert('Error', 'Failed to update next contact date');
					}
				}}
			/>
		</ScrollView>
	);
};

export default ScheduleTab;
