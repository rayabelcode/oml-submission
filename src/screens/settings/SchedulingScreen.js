import React, { useState, useEffect } from 'react';
import {
	View,
	Text,
	TouchableOpacity,
	ScrollView,
	Platform,
	ActionSheetIOS,
	Alert,
	ActivityIndicator,
} from 'react-native';
import { useStyles } from '../../styles/screens/settings';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { getUserPreferences, updateUserPreferences } from '../../utils/preferences';
import TimeRangeSelector from '../../components/settings/TimeRangeSelector';
import DaySelector from '../../components/settings/DaySelector';
import TimePickerModal from '../../components/modals/TimePickerModal';

const RELATIONSHIP_TYPES = ['work', 'family', 'friend', 'personal'];

const DURATION_OPTIONS = {
	minimumGap: [
		{ label: '5 minutes', value: 5 },
		{ label: '30 minutes', value: 30 },
		{ label: '1 hour', value: 60 },
		{ label: '4 hours', value: 240 },
		{ label: '12 hours', value: 720 },
	],
	optimalGap: [
		{ label: '30 minutes', value: 30 },
		{ label: '1 hour', value: 60 },
		{ label: '4 hours', value: 240 },
		{ label: '8 hours', value: 480 },
		{ label: '1 day', value: 1440 },
	],
};

const DEFAULT_MIN_GAP = 30;
const DEFAULT_OPTIMAL_GAP = 120;

const SchedulingScreen = ({ navigation }) => {
	const styles = useStyles();
	const { colors, spacing } = useTheme();
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [minGap, setMinGap] = useState(DEFAULT_MIN_GAP);
	const [optimalGap, setOptimalGap] = useState(DEFAULT_OPTIMAL_GAP);
	const [globalExcludedTimes, setGlobalExcludedTimes] = useState([]);
	const [relationshipSettings, setRelationshipSettings] = useState({});
	const [expandedSection, setExpandedSection] = useState(null);
	const [timePickerVisible, setTimePickerVisible] = useState(false);
	const [activeTimePicker, setActiveTimePicker] = useState(null);

	useEffect(() => {
		loadPreferences();
	}, [user.uid]);

	const loadPreferences = async () => {
		try {
			const prefs = await getUserPreferences(user.uid);
			setMinGap(prefs.minimumGapMinutes || DEFAULT_MIN_GAP);
			setOptimalGap(prefs.optimalGapMinutes || DEFAULT_OPTIMAL_GAP);
			setGlobalExcludedTimes(prefs.scheduling_preferences?.global_excluded_times || []);
			setRelationshipSettings(prefs.scheduling_preferences?.relationship_types || {});
			setLoading(false);
		} catch (error) {
			console.error('Error loading preferences:', error);
			setLoading(false);
		}
	};

	const showDurationPicker = (type) => {
		const options = type === 'minimum' ? DURATION_OPTIONS.minimumGap : DURATION_OPTIONS.optimalGap;

		if (Platform.OS === 'ios') {
			ActionSheetIOS.showActionSheetWithOptions(
				{
					options: [...options.map((o) => o.label), 'Cancel'],
					cancelButtonIndex: options.length,
				},
				(buttonIndex) => {
					if (buttonIndex < options.length) {
						const value = options[buttonIndex].value;
						if (type === 'minimum') {
							handleMinGapChange(value);
						} else {
							handleOptimalGapChange(value);
						}
					}
				}
			);
		} else {
			Alert.alert(type === 'minimum' ? 'Minimum Gap' : 'Optimal Gap', 'Select duration', [
				...options.map((option) => ({
					text: option.label,
					onPress: () => {
						if (type === 'minimum') {
							handleMinGapChange(option.value);
						} else {
							handleOptimalGapChange(option.value);
						}
					},
				})),
				{ text: 'Cancel', style: 'cancel' },
			]);
		}
	};

	const handleMinGapChange = async (value) => {
		try {
			setMinGap(value);
			await updateUserPreferences(user.uid, {
				minimumGapMinutes: value,
			});
		} catch (error) {
			console.error('Error updating minimum gap:', error);
			setMinGap(minGap);
			Alert.alert('Error', 'Failed to update minimum gap');
		}
	};

	const handleOptimalGapChange = async (value) => {
		try {
			setOptimalGap(value);
			await updateUserPreferences(user.uid, {
				optimalGapMinutes: value,
			});
		} catch (error) {
			console.error('Error updating optimal gap:', error);
			setOptimalGap(optimalGap);
			Alert.alert('Error', 'Failed to update optimal gap');
		}
	};

	const handleGlobalExcludedTimeChange = async (index, field, value) => {
		try {
			const updatedTimes = [...globalExcludedTimes];
			updatedTimes[index] = { ...updatedTimes[index], [field]: value };
			setGlobalExcludedTimes(updatedTimes);

			await updateUserPreferences(user.uid, {
				'scheduling_preferences.global_excluded_times': updatedTimes,
			});
		} catch (error) {
			console.error('Error updating global excluded times:', error);
			Alert.alert('Error', 'Failed to update excluded times');
		}
	};

	const handleRelationshipSettingChange = async (type, field, value) => {
		try {
			const updatedSettings = {
				...relationshipSettings,
				[type]: {
					...relationshipSettings[type],
					[field]: value,
				},
			};
			setRelationshipSettings(updatedSettings);

			await updateUserPreferences(user.uid, {
				'scheduling_preferences.relationship_types': updatedSettings,
			});
		} catch (error) {
			console.error('Error updating relationship settings:', error);
			Alert.alert('Error', 'Failed to update relationship settings');
		}
	};

	const formatDuration = (minutes) => {
		if (minutes < 60) return `${minutes} minutes`;
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		return remainingMinutes > 0
			? `${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} minutes`
			: `${hours} hour${hours > 1 ? 's' : ''}`;
	};

	const toggleSection = (section) => {
		setExpandedSection(expandedSection === section ? null : section);
	};

	const showTimePicker = (type, relationshipType = null, timeType = 'start') => {
		setActiveTimePicker({ type, relationshipType, timeType });
		setTimePickerVisible(true);
	};

	const handleTimeSelect = (hour) => {
		const timeString = `${hour.toString().padStart(2, '0')}:00`;

		if (activeTimePicker.type === 'global') {
			const index = activeTimePicker.relationshipType;
			const updatedTimes = [...globalExcludedTimes];
			updatedTimes[index] = {
				...updatedTimes[index],
				[activeTimePicker.timeType]: timeString,
			};
			handleGlobalExcludedTimeChange(index, activeTimePicker.timeType, timeString);
		} else {
			const type = activeTimePicker.relationshipType;
			const currentSettings = relationshipSettings[type]?.active_hours || { start: '09:00', end: '17:00' };
			const updatedHours = {
				...currentSettings,
				[activeTimePicker.timeType]: timeString,
			};
			handleRelationshipSettingChange(type, 'active_hours', updatedHours);
		}
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
			<View style={styles.headerSettingsPages}>
				<TouchableOpacity style={styles.settingItemLeft} onPress={() => navigation.goBack()}>
					<Icon name="chevron-back" size={24} color={colors.text.primary} />
					<Text style={[styles.profileName, { fontSize: 20 }]}>Scheduling</Text>
				</TouchableOpacity>
			</View>

			<ScrollView style={styles.settingsList}>
				<View style={styles.formSection}>
					<View style={styles.inputGroup}>
						<Text style={[styles.label, { fontSize: 18 }]}>Time Between Calls</Text>
						<Text style={[styles.settingText, { fontSize: 16, lineHeight: 22, marginBottom: 20 }]}>
							Set the minimum and optimal time gaps between scheduled calls to better manage your contact
							schedule.
						</Text>

						<TouchableOpacity
							style={[styles.settingItem, { borderTopWidth: 1, borderTopColor: colors.border }]}
							onPress={() => showDurationPicker('minimum')}
						>
							<View style={styles.settingItemLeft}>
								<Icon name="time-outline" size={24} color={colors.text.secondary} />
								<View style={{ marginLeft: 15 }}>
									<Text style={[styles.settingText, { fontSize: 18 }]}>Minimum Gap</Text>
									<Text style={[styles.settingText, { fontSize: 14, color: colors.text.secondary }]}>
										{formatDuration(minGap)}
									</Text>
								</View>
							</View>
							<Icon name="chevron-forward-outline" size={24} color={colors.text.secondary} />
						</TouchableOpacity>

						<TouchableOpacity style={styles.settingItem} onPress={() => showDurationPicker('optimal')}>
							<View style={styles.settingItemLeft}>
								<Icon name="timer-outline" size={24} color={colors.text.secondary} />
								<View style={{ marginLeft: 15 }}>
									<Text style={[styles.settingText, { fontSize: 18 }]}>Optimal Gap</Text>
									<Text style={[styles.settingText, { fontSize: 14, color: colors.text.secondary }]}>
										{formatDuration(optimalGap)}
									</Text>
								</View>
							</View>
							<Icon name="chevron-forward-outline" size={24} color={colors.text.secondary} />
						</TouchableOpacity>
					</View>
				</View>

				<View style={styles.formSection}>
					<TouchableOpacity style={styles.settingItem} onPress={() => toggleSection('globalExcluded')}>
						<View style={styles.settingItemLeft}>
							<Icon name="moon-outline" size={24} color={colors.text.secondary} />
							<Text style={[styles.settingText, { fontSize: 18 }]}>Global Excluded Times</Text>
						</View>
						<Icon
							name={expandedSection === 'globalExcluded' ? 'chevron-up' : 'chevron-down'}
							size={24}
							color={colors.text.secondary}
						/>
					</TouchableOpacity>

					{expandedSection === 'globalExcluded' &&
						globalExcludedTimes.map((time, index) => (
							<View key={index} style={{ marginTop: spacing.md }}>
								<TimeRangeSelector
									startTime={time.start}
									endTime={time.end}
									onStartTimePress={() => showTimePicker('global', index, 'start')}
									onEndTimePress={() => showTimePicker('global', index, 'end')}
									label={`Excluded Time ${index + 1}`}
								/>
								<DaySelector
									selectedDays={time.days}
									onDayPress={(day) => {
										const updatedDays = time.days.includes(day)
											? time.days.filter((d) => d !== day)
											: [...time.days, day];
										handleGlobalExcludedTimeChange(index, 'days', updatedDays);
									}}
								/>
							</View>
						))}
				</View>

				{RELATIONSHIP_TYPES.map((type) => (
					<View key={type} style={styles.formSection}>
						<TouchableOpacity style={styles.settingItem} onPress={() => toggleSection(type)}>
							<View style={styles.settingItemLeft}>
								<Icon
									name={
										type === 'work'
											? 'briefcase-outline'
											: type === 'family'
											? 'people-outline'
											: type === 'friend'
											? 'heart-outline'
											: 'person-outline'
									}
									size={24}
									color={colors.text.secondary}
								/>
								<Text style={[styles.settingText, { fontSize: 18 }]}>
									{type.charAt(0).toUpperCase() + type.slice(1)} Settings
								</Text>
							</View>
							<Icon
								name={expandedSection === type ? 'chevron-up' : 'chevron-down'}
								size={24}
								color={colors.text.secondary}
							/>
						</TouchableOpacity>

						{expandedSection === type && (
							<View style={{ marginTop: spacing.md }}>
								<TimeRangeSelector
									startTime={relationshipSettings[type]?.active_hours?.start || '09:00'}
									endTime={relationshipSettings[type]?.active_hours?.end || '17:00'}
									onStartTimePress={() => showTimePicker('relationship', type, 'start')}
									onEndTimePress={() => showTimePicker('relationship', type, 'end')}
									label="Active Hours"
								/>
								<Text style={[styles.label, { marginTop: spacing.md }]}>Preferred Days</Text>
								<DaySelector
									selectedDays={relationshipSettings[type]?.preferred_days || []}
									onDayPress={(day) => {
										const current = relationshipSettings[type]?.preferred_days || [];
										const updated = current.includes(day)
											? current.filter((d) => d !== day)
											: [...current, day];
										handleRelationshipSettingChange(type, 'preferred_days', updated);
									}}
								/>
							</View>
						)}
					</View>
				))}
			</ScrollView>

			<TimePickerModal
				visible={timePickerVisible}
				onClose={() => setTimePickerVisible(false)}
				onSelect={handleTimeSelect}
				initialHour={
					activeTimePicker?.type === 'global'
						? parseInt(
								globalExcludedTimes[activeTimePicker?.relationshipType]?.[activeTimePicker?.timeType] || '9'
						  )
						: parseInt(
								relationshipSettings[activeTimePicker?.relationshipType]?.active_hours?.[
									activeTimePicker?.timeType
								] || '9'
						  )
				}
				title={`Select ${activeTimePicker?.timeType === 'start' ? 'Start' : 'End'} Time`}
			/>
		</View>
	);
};

export default SchedulingScreen;
