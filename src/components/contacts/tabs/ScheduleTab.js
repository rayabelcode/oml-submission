import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useTheme, spacing } from '../../../context/ThemeContext';
import { useCommonStyles } from '../../../styles/common';
import { useStyles } from '../../../styles/screens/contacts';
import Icon from 'react-native-vector-icons/Ionicons';
import { updateContactScheduling, updateNextContact } from '../../../utils/firestore';
import { SchedulingService } from '../../../utils/scheduler';
import TimePickerModal from '../../modals/TimePickerModal';

const FREQUENCY_OPTIONS = [
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Bi-weekly', value: 'biweekly' },
    { label: 'Monthly', value: 'monthly' },
    { label: 'Quarterly', value: 'quarterly' },
    { label: 'Yearly', value: 'yearly' },
];

const PRIORITY_OPTIONS = [
    { label: 'High', value: 'high' },
    { label: 'Normal', value: 'normal' },
    { label: 'Low', value: 'low' },
];

const DAYS_OF_WEEK = [
    { label: 'Mon', value: 'monday' },
    { label: 'Tue', value: 'tuesday' },
    { label: 'Wed', value: 'wednesday' },
    { label: 'Thu', value: 'thursday' },
    { label: 'Fri', value: 'friday' },
    { label: 'Sat', value: 'saturday' },
    { label: 'Sun', value: 'sunday' },
];

const ScheduleTab = ({ contact, setSelectedContact, loadContacts }) => {
    const { colors } = useTheme();
    const styles = useStyles();
    const commonStyles = useCommonStyles();

    // State management
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
    const [frequency, setFrequency] = useState(contact?.scheduling?.frequency || 'weekly');
    const [priority, setPriority] = useState(contact?.scheduling?.custom_preferences?.priority || 'normal');
    const [selectedDays, setSelectedDays] = useState(
        contact?.scheduling?.custom_preferences?.preferred_days || []
    );
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);
    const [activeHours, setActiveHours] = useState({
        start: contact?.scheduling?.custom_preferences?.active_hours?.start || '09:00',
        end: contact?.scheduling?.custom_preferences?.active_hours?.end || '17:00',
    });

    // Get hour from time string
    const getHourFromTimeString = (timeString) => {
        return parseInt(timeString.split(':')[0]);
    };

    // Format hour to time string
    const formatHourToTimeString = (hour) => {
        return `${hour.toString().padStart(2, '0')}:00`;
    };

    // Format time for display
    const formatTimeForDisplay = (timeString) => {
        const hour = getHourFromTimeString(timeString);
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${displayHour}:00 ${period}`;
    };

    const handleUpdateScheduling = async (updates) => {
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
            console.error('Error updating scheduling preferences:', error);
            Alert.alert('Error', 'Failed to update scheduling preferences');
        }
    };

    const handleScheduleContact = async () => {
        try {
            const scheduler = new SchedulingService(
                contact.scheduling?.custom_preferences,
                [],
                Intl.DateTimeFormat().resolvedOptions().timeZone
            );

            const lastContact = contact.last_contacted || new Date();
            const reminderDetails = await scheduler.scheduleReminder(contact, lastContact, frequency);
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
            <View style={styles.scheduleContainer}>
                <Text style={styles.sectionTitle}>Contact Frequency</Text>
                <View style={[styles.frequencyPicker, { justifyContent: 'center' }]}>
                    {FREQUENCY_OPTIONS.map((option, index) => (
                        <TouchableOpacity
                            key={option.value}
                            style={[
                                styles.frequencyOption,
                                frequency === option.value && styles.frequencyOptionSelected,
                                { width: '31%', marginBottom: spacing.sm }
                            ]}
                            onPress={() => handleUpdateScheduling({ frequency: option.value })}
                        >
                            <Text
                                style={[
                                    styles.frequencyText,
                                    frequency === option.value && styles.frequencyTextSelected,
                                ]}
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
                        <Text style={[styles.sectionTitle, { marginBottom: spacing.md }]}>Priority</Text>
                        <View style={[styles.frequencyPicker, { justifyContent: 'center' }]}>
                            {PRIORITY_OPTIONS.map((option) => (
                                <TouchableOpacity
                                    key={option.value}
                                    style={[
                                        styles.frequencyOption,
                                        priority === option.value && styles.frequencyOptionSelected,
                                        { width: '31%' }
                                    ]}
                                    onPress={() => handleUpdateScheduling({ priority: option.value })}
                                >
                                    <Text
                                        style={[
                                            styles.frequencyText,
                                            priority === option.value && styles.frequencyTextSelected,
                                        ]}
                                    >
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={[styles.sectionTitle, { marginTop: spacing.lg, marginBottom: spacing.md }]}>
                            Preferred Days
                        </Text>
                        <View style={[styles.frequencyPicker, { justifyContent: 'center' }]}>
                            {DAYS_OF_WEEK.map((day) => {
                                const isSelected = selectedDays.includes(day.value);
                                return (
                                    <TouchableOpacity
                                        key={day.value}
                                        style={[
                                            styles.frequencyOption,
                                            isSelected && styles.frequencyOptionSelected,
                                            { width: '13%' }
                                        ]}
                                        onPress={() => {
                                            const updatedDays = isSelected
                                                ? selectedDays.filter((d) => d !== day.value)
                                                : [...selectedDays, day.value];
                                            handleUpdateScheduling({ preferred_days: updatedDays });
                                            setSelectedDays(updatedDays);
                                        }}
                                    >
                                        <Text style={[
                                            styles.frequencyText,
                                            isSelected && styles.frequencyTextSelected
                                        ]}>
                                            {day.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <Text style={[styles.sectionTitle, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
                            Active Hours
                        </Text>
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            marginBottom: spacing.md
                        }}>
                            <TouchableOpacity
                                style={[styles.frequencyOption, { flex: 1, marginRight: spacing.sm }]}
                                onPress={() => setShowStartTimePicker(true)}
                            >
                                <Text style={styles.frequencyText}>
                                    Start: {formatTimeForDisplay(activeHours.start)}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.frequencyOption, { flex: 1 }]}
                                onPress={() => setShowEndTimePicker(true)}
                            >
                                <Text style={styles.frequencyText}>
                                    End: {formatTimeForDisplay(activeHours.end)}
                                </Text>
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
                                                    setPriority('normal');
                                                    setActiveHours({
                                                        start: '09:00',
                                                        end: '17:00',
                                                    });
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
                    <View style={styles.nextContactContainer}>
                        <Text style={styles.nextContactLabel}>Next Contact</Text>
                        <Text style={styles.nextContactDate}>
                            {new Date(contact.next_contact).toLocaleDateString()}
                        </Text>
                    </View>
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

            <TimePickerModal
                visible={showStartTimePicker}
                onClose={() => setShowStartTimePicker(false)}
                initialHour={getHourFromTimeString(activeHours.start)}
                title="Select Start Time"
                onSelect={(hour) => {
                    const newTime = formatHourToTimeString(hour);
                    setActiveHours(prev => ({ ...prev, start: newTime }));
                    handleUpdateScheduling({
                        active_hours: { ...activeHours, start: newTime }
                    });
                }}
            />

            <TimePickerModal
                visible={showEndTimePicker}
                onClose={() => setShowEndTimePicker(false)}
                initialHour={getHourFromTimeString(activeHours.end)}
                title="Select End Time"
                onSelect={(hour) => {
                    const newTime = formatHourToTimeString(hour);
                    setActiveHours(prev => ({ ...prev, end: newTime }));
                    handleUpdateScheduling({
                        active_hours: { ...activeHours, end: newTime }
                    });
                }}
            />
        </ScrollView>
    );
};

export default ScheduleTab;
