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
	const { colors, spacing } = useTheme();
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

	// Function to load user preferences
	const loadPreferences = async () => {
		try {
			setLoading(true);
			const prefs = await getUserPreferences(user.uid);

			// Debugging: Check the fetched preferences
			console.log('Fetched preferences from Firebase:', prefs);

			// Initialize the settings with fetched data
			setRelationshipSettings(initializeSettings(prefs));
		} catch (error) {
			console.error('Error loading preferences:', error);
		} finally {
			setLoading(false);
		}
	};

	// Function to initialize settings with defaults only for missing fields
	const initializeSettings = (prefs) => {
		const relationshipTypes = prefs.relationship_types || {}; // Access the key or use an empty object as fallback

		const initializedSettings = {};
		Object.keys(RELATIONSHIP_TYPES).forEach((type) => {
			const typeData = relationshipTypes[type] || {}; // Get the data for the current type or fallback to empty object

			initializedSettings[type] = {
				active_hours: {
					start: typeData.active_hours?.start || RELATIONSHIP_DEFAULTS.active_hours[type].start,
					end: typeData.active_hours?.end || RELATIONSHIP_DEFAULTS.active_hours[type].end,
				},
				preferred_days: typeData.preferred_days || RELATIONSHIP_DEFAULTS.preferred_days[type],
				excluded_times: typeData.excluded_times || RELATIONSHIP_DEFAULTS.excluded_times[type],
			};
		});

		console.log('Initialized settings with defaults:', initializedSettings);
		return initializedSettings;
	};

	// Handle optimistic updates and Firebase save
	const handleSettingsChange = async (updatedSettings) => {
		// Optimistically update local state
		setRelationshipSettings(updatedSettings);

		try {
			// Save changes to Firebase
			await updateUserPreferences(user.uid, {
				scheduling_preferences: {
					relationship_types: updatedSettings,
				},
			});
		} catch (error) {
			console.error('Error updating relationship settings:', error);

			// Revert to the latest Firebase data if the update fails
			loadPreferences();
		}
	};

	// Handle time selection (e.g., active hours)
	const handleTimeSelect = (hour) => {
		const timeString = `${hour.toString().padStart(2, '0')}:00`;
		const { type, timeType } = activeTimePicker;

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

	// Handle day selection toggle
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

	// Reset all settings to defaults
	const handleResetToDefault = () => {
		Alert.alert(
			'Reset to Default',
			'This will reset all relationship type settings to their default values. This action cannot be undone.',
			[
				{
					text: 'Cancel',
					style: 'cancel',
				},
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

	// Show the time picker modal
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
				<View style={styles.relationshipIntroContainer}>
					<Text style={styles.relationshipIntroText}>
						Set preferred contact times and days for each of your relationship types.
					</Text>
				</View>

				{Object.entries(RELATIONSHIP_TYPES).map(([type, { label, icon, color }]) => (
					<View
						key={type}
						style={[styles.formSection, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
					>
						<TouchableOpacity
							activeOpacity={1}
							style={[styles.settingItem, { paddingVertical: spacing.md }]}
							onPress={() => setExpandedType(expandedType === type ? null : type)}
						>
							<View style={styles.settingItemLeft}>
								<Icon name={icon} size={24} color={color} />
								<Text style={[styles.settingText, { fontSize: 18 }]}>{label}</Text>
							</View>
							<Icon
								name={expandedType === type ? 'chevron-up' : 'chevron-down'}
								size={24}
								color={colors.text.secondary}
							/>
						</TouchableOpacity>

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
				))}

				<View style={styles.resetContainer}>
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
