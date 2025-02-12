import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Animated, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../../context/ThemeContext';
import { useScheduleStyles } from '../../../styles/contacts/scheduleStyle';
import {
	updateContactScheduling,
	getContactById,
	getContactReminders,
	deleteReminder,
} from '../../../utils/firestore';
import TimePickerModal from '../../modals/TimePickerModal';
import DatePickerModal from '../../modals/DatePickerModal';
import { updateDoc, doc } from 'firebase/firestore';
import { db, auth } from '../../../config/firebase';
import { DateTime } from 'luxon';
import { REMINDER_TYPES } from '../../../../constants/notificationConstants';
import {
	FREQUENCY_OPTIONS,
	PRIORITY_OPTIONS,
	DAYS_OF_WEEK,
	DEFAULT_ACTIVE_HOURS,
} from '../../../utils/scheduler/schedulerConstants';
import { SchedulingService } from '../../../utils/scheduler/scheduler';

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

const ScheduleTab = ({ contact, setSelectedContact, loadContacts }) => {
	const { colors, spacing } = useTheme();
	const styles = useScheduleStyles();

	const schedulingService = useRef(
		new SchedulingService(
			auth.currentUser?.scheduling_preferences,
			[],
			Intl.DateTimeFormat().resolvedOptions().timeZone
		)
	).current;

	// Function to format date for display
	const formatStoredDate = (dateValue) => {
		if (!dateValue) return 'Not Set';

		try {
			// Handle Firestore Timestamp
			if (dateValue?.toDate) {
				return dateValue.toDate().toLocaleDateString();
			}
			// Handle ISO string
			if (typeof dateValue === 'string') {
				return new Date(dateValue).toLocaleDateString();
			}
			// Handle Date object
			if (dateValue instanceof Date) {
				return dateValue.toLocaleDateString();
			}
			return 'Invalid Date';
		} catch (error) {
			console.warn('Error formatting date:', error);
			return 'Invalid Date';
		}
	};

	const [showSlotsFilledModal, setShowSlotsFilledModal] = useState(false);
	const [slotsFilledDetails, setSlotsFilledDetails] = useState(null);
	const [selectedDate, setSelectedDate] = useState(new Date());
	const dot1 = new Animated.Value(0);
	const dot2 = new Animated.Value(0);
	const dot3 = new Animated.Value(0);
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
		start: contact?.scheduling?.custom_preferences?.active_hours?.start || DEFAULT_ACTIVE_HOURS.start,
		end: contact?.scheduling?.custom_preferences?.active_hours?.end || DEFAULT_ACTIVE_HOURS.end,
	});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [loadingType, setLoadingType] = useState(null);

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

	const handleRecurringOff = async () => {
		try {
			setFrequency(null);
			setLoadingType('recurring');
			setLoading(true);

			await updateContactScheduling(contact.id, {
				frequency: null,
				next_contact: null,
				recurring_next_date: null,
				custom_next_date: null,
			});

			const existingReminders = await getContactReminders(contact.id, auth.currentUser.uid);

			for (const reminder of existingReminders) {
				if (reminder.type === REMINDER_TYPES.SCHEDULED || reminder.type === REMINDER_TYPES.CUSTOM_DATE) {
					try {
						await deleteReminder(reminder.id);
					} catch (err) {
						console.error('Error deleting reminder:', err);
					}
				}
			}

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
			setLoadingType(null);
		}
	};

	const handleSlotsFilledOption = async (option) => {
		try {
			setLoadingType('recurring');
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
				await updateContactScheduling(contact.id, {
					recurring_next_date: nextContactDate.toISOString(),
				});

				setSelectedContact({
					...contact,
					scheduling: {
						...contact.scheduling,
						recurring_next_date: nextContactDate.toISOString(),
					},
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
			setLoadingType(null);
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
				<View style={styles.scheduledDatesContainer}>
					<View style={styles.nextRecurringBox}>
						{loading && loadingType === 'recurring' ? (
							<View style={styles.dotsContainer}>
								<Animated.View style={[styles.dot, { opacity: dot1 }]} />
								<Animated.View style={[styles.dot, { opacity: dot2 }]} />
								<Animated.View style={[styles.dot, { opacity: dot3 }]} />
							</View>
						) : (
							<>
								<Text style={styles.scheduledDateLabel}>Next Recurring</Text>
								<Text style={styles.scheduledDateValue}>
									{formatStoredDate(contact.scheduling?.recurring_next_date)}
								</Text>
							</>
						)}
					</View>
					<View style={styles.customDateBox}>
						{loading && loadingType === 'custom' ? (
							<View style={styles.dotsContainer}>
								<Animated.View style={[styles.dot, { opacity: dot1 }]} />
								<Animated.View style={[styles.dot, { opacity: dot2 }]} />
								<Animated.View style={[styles.dot, { opacity: dot3 }]} />
							</View>
						) : (
							<>
								<Text style={styles.scheduledDateLabel}>Custom Date</Text>
								<Text style={styles.scheduledDateValue}>
									{formatStoredDate(contact.scheduling?.custom_next_date)}
								</Text>
							</>
						)}
					</View>
				</View>
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
									setLoadingType('recurring');
									setLoading(true);
									if (frequency === option.value) {
										setFrequency(null);
										const updatedContact = await updateContactScheduling(contact.id, {
											frequency: null,
											recurring_next_date: null,
										});

										setSelectedContact(updatedContact);

										if (loadContacts) {
											await loadContacts();
										}
										setLoading(false);
										setLoadingType(null);
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
									setLoadingType(null);
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
								setLoadingType('custom');
								setLoading(true);
								const updates = {
									custom_next_date: null,
								};

								if (!contact.scheduling?.recurring_next_date) {
									updates.next_contact = null;
									const existingReminders = await getContactReminders(contact.id, auth.currentUser.uid);
									const deletePromises = existingReminders
										.map((reminder) => {
											if (reminder.type === REMINDER_TYPES.CUSTOM_DATE) {
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
								setLoadingType(null);
							}
						} else {
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

											// Don't allow removing the last day
											if (updatedDays.length === 0) {
												Alert.alert('Required Selection', 'At least one preferred day must be selected.');
												return;
											}

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
									Start: {schedulingService.formatTimeForDisplay(activeHours.start)}
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.timeButton, loading && styles.disabledButton]}
								onPress={() => setShowEndTimePicker(true)}
								disabled={loading}
							>
								<Text style={[styles.timeText, loading && styles.disabledText]}>
									End: {schedulingService.formatTimeForDisplay(activeHours.end)}
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			)}

			<TimePickerModal
				visible={showStartTimePicker}
				onClose={() => setShowStartTimePicker(false)}
				initialHour={parseInt(activeHours.start.split(':')[0])}
				title="Earliest Call Time"
				onSelect={async (hour) => {
					const newTime = schedulingService.formatHourToTimeString(hour);
					const endHour = parseInt(activeHours.end.split(':')[0]);

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
				initialHour={parseInt(activeHours.end.split(':')[0])}
				title="Latest Call Time"
				onSelect={async (hour) => {
					const newTime = schedulingService.formatHourToTimeString(hour);
					const startHour = parseInt(activeHours.start.split(':')[0]);

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
					if (!date || event.type !== 'set') return;

					try {
						setShowDatePicker(false);
						setLoadingType('custom');
						setLoading(true);

						const finalDate = schedulingService.generateCustomDate(date, activeHours);

						const updatedContact = await updateContactScheduling(contact.id, {
							custom_next_date: finalDate.toISOString(),
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
						setLoadingType(null);
					}
				}}
			/>
		</ScrollView>
	);
};

export default ScheduleTab;
