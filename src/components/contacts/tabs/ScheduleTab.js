import React, { useState, useEffect } from 'react';
import {
	View,
	Text,
	TouchableOpacity,
	ScrollView,
	Alert,
	ActivityIndicator,
	Animated,
	Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../../context/ThemeContext';
import { useScheduleStyles } from '../../../styles/contacts/scheduleStyle';
import {
	updateContactScheduling,
	updateNextContact,
	getContactById,
	getContactReminders,
	deleteReminder,
} from '../../../utils/firestore';
import { SchedulingService } from '../../../utils/scheduler';
import TimePickerModal from '../../modals/TimePickerModal';
import DatePickerModal from '../../modals/DatePickerModal';
import { updateDoc, doc } from 'firebase/firestore';
import { db, auth } from '../../../config/firebase';
import { DateTime } from 'luxon';
import { REMINDER_TYPES } from '../../../../constants/notificationConstants';

const SlotsFilledModal = ({ isVisible, onClose, details, onOptionSelect }) => {
	const styles = useScheduleStyles();

	return (
		<Modal visible={isVisible} transparent={true} animationType="fade" onRequestClose={onClose}>
			<View style={styles.modalOverlay}>
				<View style={styles.modalContent}>
					<Text style={styles.modalTitle}>Schedule Unavailable</Text>
					<Text style={styles.modalMessage}>
						{`${details?.date} is fully booked during ${details?.workingHours}`}
					</Text>

					<View style={styles.modalOptions}>
						{details?.nextAvailableDay && (
							<TouchableOpacity style={styles.modalOption} onPress={() => onOptionSelect('next_day')}>
								<Text style={styles.modalOptionText}>Try {details.nextAvailableDay}</Text>
							</TouchableOpacity>
						)}

						<TouchableOpacity style={styles.modalOption} onPress={() => onOptionSelect('next_week')}>
							<Text style={styles.modalOptionText}>Schedule for next week</Text>
						</TouchableOpacity>
					</View>

					<TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
						<Text style={styles.modalCloseText}>Cancel</Text>
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	);
};

const FREQUENCY_OPTIONS = [
	{ label: 'Daily', value: 'daily' },
	{ label: 'Weekly', value: 'weekly' },
	{ label: 'Bi-Weekly', value: 'biweekly' },
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
	const [showSlotsFilledModal, setShowSlotsFilledModal] = useState(false);
	const [slotsFilledDetails, setSlotsFilledDetails] = useState(null);

	// Date Picker default
	const [selectedDate, setSelectedDate] = useState(new Date());

	// Loading Animation
	const dot1 = new Animated.Value(0);
	const dot2 = new Animated.Value(0);
	const dot3 = new Animated.Value(0);

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

	useEffect(() => {
		if (loading) {
			Animated.loop(
				Animated.sequence([
					Animated.timing(dot1, {
						toValue: 1,
						duration: 200,
						useNativeDriver: true,
					}),
					Animated.timing(dot2, {
						toValue: 1,
						duration: 200,
						useNativeDriver: true,
					}),
					Animated.timing(dot3, {
						toValue: 1,
						duration: 200,
						useNativeDriver: true,
					}),
					Animated.parallel([
						Animated.timing(dot1, {
							toValue: 0,
							duration: 200,
							useNativeDriver: true,
						}),
						Animated.timing(dot2, {
							toValue: 0,
							duration: 200,
							useNativeDriver: true,
						}),
						Animated.timing(dot3, {
							toValue: 0,
							duration: 200,
							useNativeDriver: true,
						}),
					]),
				])
			).start();
		} else {
			dot1.setValue(0);
			dot2.setValue(0);
			dot3.setValue(0);
		}
	}, [loading]);

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
	const handleUpdateScheduling = async (updates) => {
		setError(null);
		setLoading(true);
		try {
			await updateContactScheduling(contact.id, updates);
			setSelectedContact((prev) => ({
				...prev,
				scheduling: {
					...prev.scheduling,
					...updates,
				},
			}));
		} catch (error) {
			setError('Failed to update scheduling preferences');
			console.error('Error updating scheduling preferences:', error);
		} finally {
			setLoading(false);
		}
	};

	// Handle recurring off
	const handleRecurringOff = async () => {
		try {
			setFrequency(null);
			setLoading(true);
			// Get existing reminders for this contact
			const existingReminders = await getContactReminders(contact.id, auth.currentUser.uid);

			// Delete any SCHEDULED type reminders
			const deletePromises = existingReminders
				.map((reminder) => {
					if (reminder.type === REMINDER_TYPES.SCHEDULED) {
						return deleteReminder(reminder.id);
					}
				})
				.filter(Boolean);

			await Promise.all([
				updateContactScheduling(contact.id, {
					frequency: null,
					next_contact: null,
					recurring_next_date: null,
					custom_next_date: null,
				}),
				...deletePromises,
			]);

			setSelectedContact({
				...contact,
				scheduling: {
					...contact.scheduling,
					frequency: null,
					recurring_next_date: null,
					custom_next_date: null,
				},
				next_contact: null,
			});
		} catch (error) {
			console.error('Error turning off recurring:', error);
			setError('Failed to turn off recurring');
			setFrequency(contact?.scheduling?.frequency || null);
		} finally {
			setLoading(false);
		}
	};

	// Handle slots filled option
	const handleSlotsFilledOption = async (option) => {
		try {
			setLoading(true);
			let nextContactDate;

			switch (option) {
				case 'next_day':
					nextContactDate = DateTime.now()
						.plus({ days: 1 })
						.set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
						.toJSDate();
					break;

				case 'next_week':
					nextContactDate = DateTime.fromJSDate(new Date())
						.plus({ weeks: 1 })
						.set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
						.toJSDate();
					break;
			}

			if (nextContactDate) {
				// Update only the root level next_contact
				await updateContactScheduling(contact.id, {
					next_contact: nextContactDate,
				});

				setSelectedContact({
					...contact,
					next_contact: nextContactDate.toISOString(),
				});

				if (loadContacts) {
					await loadContacts();
				}
			}
		} catch (error) {
			console.error('Error handling slots filled option:', error);
			setError('Failed to update schedule');
		} finally {
			setLoading(false);
			setShowSlotsFilledModal(false);
		}
	};

	return (
		<ScrollView
			style={styles.container}
			contentContainerStyle={{ paddingBottom: spacing.xl }}
			showsVerticalScrollIndicator={false}
		>
			<View style={styles.dateSection}>
				<View style={styles.nextContactContainer}>
					<Text style={styles.nextContactLabel}>Next Contact</Text>
					{loading ? (
						<View style={styles.dotsContainer}>
							<Animated.View style={[styles.dot, { opacity: dot1 }]} />
							<Animated.View style={[styles.dot, { opacity: dot2 }]} />
							<Animated.View style={[styles.dot, { opacity: dot3 }]} />
						</View>
					) : (
						<Text style={[styles.nextContactDate, !contact.next_contact && styles.unscheduledText]}>
							{contact.next_contact ? new Date(contact.next_contact).toLocaleDateString() : 'Unscheduled'}
						</Text>
					)}
				</View>

				{Boolean(contact.scheduling?.recurring_next_date && contact.scheduling?.custom_next_date) && (
					<View style={styles.scheduledDatesContainer}>
						<Text style={{ marginBottom: 8 }}>
							<Text style={styles.scheduledDateLabel}>Next Recurring: </Text>
							<Text style={styles.scheduledDateRow}>
								{new Date(contact.scheduling.recurring_next_date).toLocaleDateString()}
							</Text>
						</Text>
						<Text>
							<Text style={styles.scheduledDateLabel}>Custom Date: </Text>
							<Text style={styles.scheduledDateRow}>
								{new Date(contact.scheduling.custom_next_date).toLocaleDateString()}
							</Text>
						</Text>
					</View>
				)}
			</View>
			<View style={styles.gridContainer}>
				<Text style={styles.sectionTitle}>Contact Frequency</Text>
				<View style={styles.frequencyGrid}>
					{FREQUENCY_OPTIONS.map((option) => (
						<TouchableOpacity
							key={option.value}
							style={[styles.frequencyButton, frequency === option.value && styles.frequencyButtonActive]}
							onPress={async () => {
								if (loading) return;
								try {
									setLoading(true);
									// If the button is already active, turn it off
									if (frequency === option.value) {
										setFrequency(null);
										const existingReminders = await getContactReminders(contact.id, auth.currentUser.uid);

										if (!contact.scheduling?.custom_next_date) {
											const deletePromises = existingReminders
												.map((reminder) => {
													if (reminder.type === REMINDER_TYPES.SCHEDULED) {
														return deleteReminder(reminder.id);
													}
												})
												.filter(Boolean);

											await Promise.all([
												updateContactScheduling(contact.id, {
													frequency: null,
													recurring_next_date: null,
													next_contact: contact.scheduling?.custom_next_date || null,
												}),
												...deletePromises,
											]);
										} else {
											await updateContactScheduling(contact.id, {
												frequency: null,
												recurring_next_date: null,
												next_contact: contact.scheduling.custom_next_date,
											});
										}

										const updatedContact = await getContactById(contact.id);
										setSelectedContact(updatedContact);

										if (loadContacts) {
											await loadContacts();
										}
										setLoading(false);
										return;
									}

									setFrequency(option.value);
									const updatedContact = await updateContactScheduling(contact.id, {
										frequency: option.value,
									});

									if (updatedContact.status === 'SLOTS_FILLED') {
										setSlotsFilledDetails(updatedContact.details);
										setShowSlotsFilledModal(true);
										return;
									}

									setSelectedContact(updatedContact);
									if (loadContacts) {
										await loadContacts();
									}
								} catch (error) {
									console.error('Error updating frequency:', error);
									setFrequency(contact?.scheduling?.frequency || null);
									setError('Failed to update frequency');
								} finally {
									setLoading(false);
								}
							}}
							disabled={loading}
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
			<View style={styles.actionButtonsContainer}>
				<TouchableOpacity
					style={[styles.customDateButton, loading && styles.disabledButton]}
					onPress={async () => {
						if (loading) return;

						if (contact.scheduling?.custom_next_date) {
							try {
								setLoading(true);
								const updates = {
									custom_next_date: null,
								};

								if (!contact.scheduling?.recurring_next_date) {
									updates.next_contact = null;
									const existingReminders = await getContactReminders(contact.id, auth.currentUser.uid);
									const deletePromises = existingReminders
										.map((reminder) => {
											if (reminder.type === REMINDER_TYPES.SCHEDULED) {
												return deleteReminder(reminder.id);
											}
										})
										.filter(Boolean);

									await Promise.all([updateContactScheduling(contact.id, updates), ...deletePromises]);
								} else {
									await updateContactScheduling(contact.id, updates);
								}

								const updatedContact = await getContactById(contact.id);
								setSelectedContact(updatedContact);

								if (loadContacts) {
									await loadContacts();
								}
							} catch (error) {
								console.error('Error clearing custom date:', error);
								Alert.alert('Error', 'Failed to clear custom date');
							} finally {
								setLoading(false);
							}
						} else {
							// Reset selectedDate to current date when opening picker
							setSelectedDate(new Date());
							setShowDatePicker(true);
						}
					}}
					disabled={loading}
				>
					<Text style={styles.customDateText}>
						{contact.scheduling?.custom_next_date ? 'Remove Custom' : 'Set Custom Date'}
					</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={[styles.recurringOffButton, loading && styles.disabledButton]}
					onPress={handleRecurringOff}
					disabled={loading}
				>
					<Text style={styles.recurringOffText}>No Contact</Text>
				</TouchableOpacity>
			</View>
			{error && <Text style={styles.errorText}>{error}</Text>}
			<TouchableOpacity
				style={[styles.advancedSettingsButton, loading && styles.disabledButton]}
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
					<View style={styles.priorityContainer}>
						<Text style={[styles.sectionTitle, loading && styles.disabledText]}>Priority</Text>
						<View style={styles.priorityButtons}>
							{PRIORITY_OPTIONS.map((option) => (
								<TouchableOpacity
									key={option.value}
									style={[
										styles.priorityButton,
										priority === option.value && styles.priorityButtonActive,
										loading && styles.disabledButton,
									]}
									onPress={async () => {
										if (loading) return;
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
											setPriority(contact?.scheduling?.priority || 'normal');
										}
									}}
									disabled={loading}
								>
									<Text
										style={[
											styles.priorityText,
											priority === option.value && styles.priorityTextActive,
											loading && styles.disabledText,
										]}
									>
										{option.label}
									</Text>
								</TouchableOpacity>
							))}
						</View>
					</View>

					<View style={styles.daysContainer}>
						<Text style={[styles.sectionTitle, loading && styles.disabledText]}>Preferred Days</Text>
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
										onPress={async () => {
											if (loading) return;
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
										disabled={loading}
									>
										<Text
											style={[
												styles.dayText,
												isSelected && styles.dayTextActive,
												loading && styles.disabledText,
											]}
										>
											{day.label}
										</Text>
									</TouchableOpacity>
								);
							})}
						</View>
					</View>

					<View style={styles.hoursContainer}>
						<Text style={[styles.sectionTitle, loading && styles.disabledText]}>Active Hours</Text>
						<View style={styles.hoursRow}>
							<TouchableOpacity
								style={[styles.timeButton, loading && styles.disabledButton]}
								onPress={() => setShowStartTimePicker(true)}
								disabled={loading}
							>
								<Text style={[styles.timeText, loading && styles.disabledText]}>
									Start: {formatTimeForDisplay(activeHours.start)}
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.timeButton, loading && styles.disabledButton]}
								onPress={() => setShowEndTimePicker(true)}
								disabled={loading}
							>
								<Text style={[styles.timeText, loading && styles.disabledText]}>
									End:{formatTimeForDisplay(activeHours.end)}
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			)}
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
			<SlotsFilledModal
				isVisible={showSlotsFilledModal}
				onClose={() => setShowSlotsFilledModal(false)}
				details={slotsFilledDetails}
				onOptionSelect={handleSlotsFilledOption}
			/>
			<DatePickerModal
				visible={showDatePicker}
				selectedDate={selectedDate}
				minimumDate={new Date()}
				onClose={() => setShowDatePicker(false)}
				onDateSelect={async (event, date) => {
					if (!date) return;
					if (date < new Date()) {
						Alert.alert('Invalid Date', 'Please select a date in the future');
						return;
					}

					try {
						setShowDatePicker(false);
						setLoading(true);

						const updatedContact = await updateContactScheduling(contact.id, {
							custom_next_date: date.toISOString(),
						});

						setSelectedContact(updatedContact);

						if (loadContacts) {
							await loadContacts();
						}
					} catch (error) {
						console.error('Error setting custom date:', error);
						Alert.alert('Error', 'Failed to set custom date');
					} finally {
						setLoading(false);
					}
				}}
			/>
		</ScrollView>
	);
};

export default ScheduleTab;
