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
import { getUserPreferences, updateUserPreferences, defaultPreferences } from '../../utils/preferences';
import TimeRangeSelector from '../../components/settings/TimeRangeSelector';
import DaySelector from '../../components/settings/DaySelector';
import TimePickerModal from '../../components/modals/TimePickerModal';

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

const DEFAULT_MIN_GAP = defaultPreferences.minimumGapMinutes;
const DEFAULT_OPTIMAL_GAP = defaultPreferences.optimalGapMinutes;

const SchedulingScreen = ({ navigation }) => {
	const styles = useStyles();
	const { colors, spacing, layout } = useTheme();
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [minGap, setMinGap] = useState(DEFAULT_MIN_GAP);
	const [optimalGap, setOptimalGap] = useState(DEFAULT_OPTIMAL_GAP);
	const [globalExcludedTimes, setGlobalExcludedTimes] = useState([]);
	const [expandedSection, setExpandedSection] = useState(null);
	const [timePickerVisible, setTimePickerVisible] = useState(false);
	const [activeTimePicker, setActiveTimePicker] = useState(null);
	const [allPreferences, setAllPreferences] = useState(null);

	useEffect(() => {
		loadPreferences();
	}, [user.uid]);

	const loadPreferences = async () => {
		try {
			const prefs = await getUserPreferences(user.uid);
			setAllPreferences(prefs);
			setMinGap(prefs.minimumGapMinutes || DEFAULT_MIN_GAP);
			setOptimalGap(prefs.optimalGapMinutes || DEFAULT_OPTIMAL_GAP);
			setGlobalExcludedTimes(prefs.global_excluded_times || defaultPreferences.global_excluded_times);

			setLoading(false);
		} catch (error) {
			console.error('Error loading preferences:', error);
			setLoading(false);
		}
	};

	const handleTimeSelect = (hour) => {
		const timeString = `${hour.toString().padStart(2, '0')}:00`;
		const index = activeTimePicker.index;
		const timeType = activeTimePicker.timeType;

		const updatedTimes = [...globalExcludedTimes];
		if (!updatedTimes[index]) {
			updatedTimes[index] = {
				days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
				start: '23:00',
				end: '07:00',
			};
		}
		updatedTimes[index][timeType] = timeString;

		handleGlobalExcludedTimeChange(updatedTimes);
		setTimePickerVisible(false);
	};

	const handleGlobalExcludedTimeChange = async (updatedTimes) => {
		try {
			setGlobalExcludedTimes(updatedTimes);
			const updatedPreferences = {
				...allPreferences,
				global_excluded_times: updatedTimes,
			};
			setAllPreferences(updatedPreferences);
			await updateUserPreferences(user.uid, {
				scheduling_preferences: updatedPreferences,
			});
		} catch (error) {
			console.error('Error updating global excluded times:', error);
			Alert.alert('Error', 'Failed to update excluded times');
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

	const formatDuration = (minutes) => {
		if (minutes < 60) return `${minutes} minutes`;
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		return remainingMinutes > 0
			? `${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} minutes`
			: `${hours} hour${hours > 1 ? 's' : ''}`;
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
				{/* Call Gap Section */}
				<View style={[styles.formSection, styles.card]}>
					<Text style={[styles.label, { fontSize: 18, textAlign: 'center', marginTop: spacing.md }]}>
						Time Between Calls
					</Text>
					<Text
						style={[
							styles.settingText,
							{ fontSize: 14, color: colors.text.secondary, marginBottom: spacing.md, textAlign: 'center' },
						]}
					>
						Minimum time between scheduled calls.
					</Text>

					<TouchableOpacity style={styles.settingItem} onPress={() => showDurationPicker('minimum')}>
						<View style={styles.settingItemLeft}>
							<Icon name="time-outline" size={24} color={colors.text.secondary} />
							<View style={{ marginLeft: spacing.sm }}>
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
							<View style={{ marginLeft: spacing.sm }}>
								<Text style={[styles.settingText, { fontSize: 18 }]}>Optimal Gap</Text>
								<Text style={[styles.settingText, { fontSize: 14, color: colors.text.secondary }]}>
									{formatDuration(optimalGap)}
								</Text>
							</View>
						</View>
						<Icon name="chevron-forward-outline" size={24} color={colors.text.secondary} />
					</TouchableOpacity>
				</View>

				{/* Global Excluded Times Section */}
				<View style={[styles.formSection, styles.card]}>
					<Text style={[styles.label, { fontSize: 18, textAlign: 'center' }]}>Global Excluded Times</Text>
					<Text
						style={[
							styles.settingText,
							{ fontSize: 14, color: colors.text.secondary, marginBottom: spacing.md, textAlign: 'center' },
						]}
					>
						When calls should not be scheduled.
					</Text>

					<TouchableOpacity
						style={styles.settingItem}
						onPress={() => setExpandedSection(expandedSection === 'globalExcluded' ? null : 'globalExcluded')}
					>
						<View style={styles.settingItemLeft}>
							<Icon name="moon-outline" size={24} color={colors.text.secondary} />
							<Text style={[styles.settingText, { fontSize: 18 }]}>Excluded Times</Text>
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
									onStartTimePress={() => showTimePicker(index, 'start')}
									onEndTimePress={() => showTimePicker(index, 'end')}
									label=""
								/>
								<DaySelector
									selectedDays={time.days || []}
									onDayPress={(day) => {
										const updatedTimes = [...globalExcludedTimes];
										const updatedDays = time.days?.includes(day)
											? time.days.filter((d) => d !== day)
											: [...(time.days || []), day];
										updatedTimes[index] = { ...time, days: updatedDays };
										handleGlobalExcludedTimeChange(updatedTimes);
									}}
								/>
							</View>
						))}
				</View>

				{/* Relationship Settings Section */}
				<View style={[styles.formSection, styles.card]}>
					<Text style={[styles.label, { fontSize: 18, textAlign: 'center' }]}>Relationship Settings</Text>
					<Text
						style={[
							styles.settingText,
							{ fontSize: 14, color: colors.text.secondary, marginBottom: spacing.md, textAlign: 'center' },
						]}
					>
						Set preferences by relationship type.
					</Text>

					<TouchableOpacity
						style={styles.settingItem}
						onPress={() => navigation.navigate('RelationshipTypeSettings')}
					>
						<View style={styles.settingItemLeft}>
							<Icon name="people-outline" size={24} color={colors.text.secondary} />
							<Text style={[styles.settingText, { fontSize: 18 }]}>Manage Relationship Types</Text>
						</View>
						<Icon name="chevron-forward-outline" size={24} color={colors.text.secondary} />
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
								globalExcludedTimes[activeTimePicker.index]?.[activeTimePicker.timeType]?.split(':')[0] || '9'
						  )
						: 9
				}
				title={`Select ${activeTimePicker?.timeType === 'start' ? 'Start' : 'End'} Time`}
			/>
		</View>
	);
};

export default SchedulingScreen;
