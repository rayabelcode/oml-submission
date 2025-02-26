import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useStyles } from '../../styles/screens/settings';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { getUserPreferences, updateUserPreferences } from '../../utils/preferences';
import TimeRangeSelector from '../../components/settings/TimeRangeSelector';
import DaySelector from '../../components/settings/DaySelector';
import TimePickerModal from '../../components/modals/TimePickerModal';
import { RELATIONSHIP_TYPES, RELATIONSHIP_DEFAULTS } from '../../../constants/relationships';

const RelationshipTypeSettings = ({ navigation }) => {
	const styles = useStyles();
	const { colors, spacing, layout } = useTheme();
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [expandedType, setExpandedType] = useState(null);
	const [relationshipSettings, setRelationshipSettings] = useState({});
	const [timePickerVisible, setTimePickerVisible] = useState(false);
	const [activeTimePicker, setActiveTimePicker] = useState(null);

	// Load preferences on initial mount
	useEffect(() => {
		loadPreferences();
	}, [user.uid]);

	// Load user preferences
	const loadPreferences = async () => {
		try {
			setLoading(true);
			const prefs = await getUserPreferences(user.uid);
			setRelationshipSettings(initializeSettings(prefs));
		} catch (error) {
			console.error('Error loading preferences:', error);
		} finally {
			setLoading(false);
		}
	};

	// Initialize settings with defaults for missing fields
	const initializeSettings = (prefs) => {
		const relationshipTypes = prefs.relationship_types || {};
		const initializedSettings = {};

		Object.keys(RELATIONSHIP_TYPES).forEach((type) => {
			const typeData = relationshipTypes[type] || {};
			initializedSettings[type] = {
				active_hours: {
					start: typeData.active_hours?.start || RELATIONSHIP_DEFAULTS.active_hours[type].start,
					end: typeData.active_hours?.end || RELATIONSHIP_DEFAULTS.active_hours[type].end,
				},
				preferred_days: typeData.preferred_days || RELATIONSHIP_DEFAULTS.preferred_days[type],
				excluded_times: typeData.excluded_times || RELATIONSHIP_DEFAULTS.excluded_times[type],
			};
		});
		return initializedSettings;
	};

	// Validate time ranges and update settings
	const handleTimeSelect = (hour) => {
		const timeString = `${hour.toString().padStart(2, '0')}:00`;
		const { type, timeType } = activeTimePicker;

		const start =
			timeType === 'activeHoursStart' ? timeString : relationshipSettings[type]?.active_hours?.start;
		const end = timeType === 'activeHoursEnd' ? timeString : relationshipSettings[type]?.active_hours?.end;

		// Validate time range
		if (timeType === 'activeHoursStart' && end && hour >= parseInt(end.split(':')[0])) {
			Alert.alert('Invalid Time', 'Start time must be before end time', [{ text: 'OK' }]);
			return;
		}
		if (timeType === 'activeHoursEnd' && start && hour <= parseInt(start.split(':')[0])) {
			Alert.alert('Invalid Time', 'End time must be after start time', [{ text: 'OK' }]);
			return;
		}

		// Update settings optimistically
		const updatedSettings = {
			...relationshipSettings,
			[type]: {
				...relationshipSettings[type],
				active_hours: {
					...relationshipSettings[type]?.active_hours,
					[timeType === 'activeHoursStart' ? 'start' : 'end']: timeString,
				},
			},
		};

		handleSettingsChange(updatedSettings);
		setTimePickerVisible(false);
	};

	// Handle settings change
	const handleSettingsChange = async (updatedSettings) => {
		setRelationshipSettings(updatedSettings);
		try {
			await updateUserPreferences(user.uid, {
				scheduling_preferences: {
					relationship_types: updatedSettings,
				},
			});
		} catch (error) {
			console.error('Error updating relationship settings:', error);
			loadPreferences();
		}
	};

	// Handle day toggling
	const toggleDaySelection = (type, day) => {
		const currentDays = relationshipSettings[type]?.preferred_days || [];
		const updatedDays = currentDays.includes(day)
			? currentDays.filter((d) => d !== day)
			: [...currentDays, day];

		const updatedSettings = {
			...relationshipSettings,
			[type]: {
				...relationshipSettings[type],
				preferred_days: updatedDays,
			},
		};

		handleSettingsChange(updatedSettings);
	};

	// Reset settings to defaults
	const handleResetToDefault = () => {
		Alert.alert(
			'Reset to Default',
			'This will reset all relationship type settings to their default values. This action cannot be undone.',
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Reset',
					style: 'destructive',
					onPress: async () => {
						const defaultSettings = initializeSettings({});
						await handleSettingsChange(defaultSettings);
					},
				},
			]
		);
	};

	// Show time picker
	const showTimePicker = (type, timeType) => {
		setActiveTimePicker({ type, timeType });
		setTimePickerVisible(true);
	};

	if (loading) {
		return (
			<View style={[styles.container, styles.loadingOverlay]}>
				<ActivityIndicator size="large" color={colors.primary} />
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<View style={[styles.headerSettingsPages, { flexDirection: 'row', alignItems: 'center' }]}>
				<TouchableOpacity style={[styles.settingItemLeft, { flex: 1 }]} onPress={() => navigation.goBack()}>
					<Icon name="chevron-back" size={24} color={colors.text.primary} />
					<Text style={[styles.profileName, { fontSize: 20 }]}>Relationship Types</Text>
				</TouchableOpacity>
			</View>

			<ScrollView style={styles.settingsList}>
				<View style={[styles.relationshipIntroContainer, styles.card]}>
					<Text style={styles.relationshipIntroText}>
						Set preferred contact times and days for each of your relationship types.
					</Text>
				</View>

				{Object.entries(RELATIONSHIP_TYPES).map(([type, { label, icon, color }], typeIndex, typeArray) => (
					<View key={type} style={[styles.formSection, styles.card]}>
						<View>
							{[{ type, label, icon, color }].map((item, index, array) => (
								<TouchableOpacity
									key={item.type}
									activeOpacity={1}
									style={[
										styles.settingItem,
										{ paddingVertical: spacing.md },
										index === array.length - 1 && { borderBottomWidth: 0 },
									]}
									onPress={() => setExpandedType(expandedType === item.type ? null : item.type)}
								>
									<View style={styles.settingItemLeft}>
										<Icon name={item.icon} size={24} color={item.color} />
										<Text style={[styles.settingText, { fontSize: 18 }]}>{item.label}</Text>
									</View>
									<Icon
										name={expandedType === item.type ? 'chevron-up' : 'chevron-down'}
										size={24}
										color={colors.text.secondary}
									/>
								</TouchableOpacity>
							))}

							{expandedType === type && (
								<View style={{ marginTop: spacing.md, paddingHorizontal: spacing.md }}>
									<TimeRangeSelector
										startTime={relationshipSettings[type]?.active_hours?.start}
										endTime={relationshipSettings[type]?.active_hours?.end}
										onStartTimePress={() => showTimePicker(type, 'activeHoursStart')}
										onEndTimePress={() => showTimePicker(type, 'activeHoursEnd')}
										label="Active Hours"
									/>
									<DaySelector
										selectedDays={relationshipSettings[type]?.preferred_days || []}
										onDayPress={(day) => toggleDaySelection(type, day)}
									/>
								</View>
							)}
						</View>
					</View>
				))}

				<View style={[styles.resetContainer]}>
					<TouchableOpacity style={styles.resetButton} onPress={handleResetToDefault}>
						<Text style={styles.resetButtonText}>Reset to Default</Text>
					</TouchableOpacity>
				</View>
			</ScrollView>

			<TimePickerModal
				visible={timePickerVisible}
				onClose={() => setTimePickerVisible(false)}
				onSelect={handleTimeSelect}
				initialHour={
					activeTimePicker
						? parseInt(
								relationshipSettings[activeTimePicker.type]?.active_hours?.[
									activeTimePicker.timeType === 'activeHoursStart' ? 'start' : 'end'
								]?.split(':')[0]
						  )
						: 9
				}
				title={`Select ${activeTimePicker?.timeType === 'activeHoursStart' ? 'Start' : 'End'} Time`}
			/>
		</View>
	);
};

export default RelationshipTypeSettings;
