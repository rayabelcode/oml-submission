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
		{ label: '15 minutes', value: 15 },
		{ label: '30 minutes', value: 30 },
		{ label: '1 hour', value: 60 },
		{ label: '2 hours', value: 120 },
		{ label: '4 hours', value: 240 },
	],
	optimalGap: [
		{ label: '1 hour', value: 60 },
		{ label: '2 hours', value: 120 },
		{ label: '4 hours', value: 240 },
		{ label: '8 hours', value: 480 },
		{ label: '12 hours', value: 720 },
		{ label: '24 hours', value: 1440 },
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

			// Confirm valid default values
			const savedMinGap = prefs.minimumGapMinutes || DEFAULT_MIN_GAP;
			const savedOptimalGap = prefs.optimalGapMinutes || DEFAULT_OPTIMAL_GAP;

			if (savedMinGap > savedOptimalGap) {
				// If saved values are invalid, reset to defaults
				setMinGap(DEFAULT_MIN_GAP);
				setOptimalGap(DEFAULT_OPTIMAL_GAP);
				// Update preferences with corrected values
				await updateUserPreferences(user.uid, {
					scheduling_preferences: {
						...prefs,
						minimumGapMinutes: DEFAULT_MIN_GAP,
						optimalGapMinutes: DEFAULT_OPTIMAL_GAP,
					},
				});
			} else {
				setMinGap(savedMinGap);
				setOptimalGap(savedOptimalGap);
			}

			setGlobalExcludedTimes(prefs.global_excluded_times || defaultPreferences.global_excluded_times);
			setLoading(false);
		} catch (error) {
			console.error('Error loading preferences:', error);
			setLoading(false);
		}
	};

	const validateGapTimes = (minGapValue, optimalGapValue) => {
		if (minGapValue > optimalGapValue) {
			Alert.alert(
				'Invalid Time Gap',
				'Minimum gap cannot be longer than optimal gap. Please select a shorter minimum gap or a longer optimal gap.',
				[{ text: 'OK' }]
			);
			return false;
		}
		return true;
	};

	const handleMinGapChange = async (value) => {
		try {
			// Validate against current optimal gap
			if (!validateGapTimes(value, optimalGap)) {
				return;
			}

			setMinGap(value);
			const updatedPreferences = {
				...allPreferences,
				minimumGapMinutes: value,
			};
			setAllPreferences(updatedPreferences);
			await updateUserPreferences(user.uid, {
				scheduling_preferences: updatedPreferences,
			});
		} catch (error) {
			console.error('Error updating minimum gap:', error);
			Alert.alert('Error', 'Failed to update minimum gap. Please try again.');
		}
	};

	const handleOptimalGapChange = async (value) => {
		try {
			// Validate against current minimum gap
			if (!validateGapTimes(minGap, value)) {
				return;
			}

			setOptimalGap(value);
			const updatedPreferences = {
				...allPreferences,
				optimalGapMinutes: value,
			};
			setAllPreferences(updatedPreferences);
			await updateUserPreferences(user.uid, {
				scheduling_preferences: updatedPreferences,
			});
		} catch (error) {
			console.error('Error updating optimal gap:', error);
			Alert.alert('Error', 'Failed to update optimal gap. Please try again.');
		}
	};

	const handleTimeSelect = (hour) => {
		const timeString = `${hour.toString().padStart(2, '0')}:00`;
		const index = activeTimePicker.index;
		const timeType = activeTimePicker.timeType;

		// Create temporary copy to validate
		const tempTimes = [...globalExcludedTimes];
		if (!tempTimes[index]) {
			tempTimes[index] = {
				days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
				start: '23:00',
				end: '07:00',
			};
		}

		// Create temporary object for validation
		const tempTimeRange = {
			...tempTimes[index],
			[timeType]: timeString,
		};

		// Validate the time range
		const { start, end } = tempTimeRange;
		if (start && end) {
			const [startHour, startMinute] = start.split(':').map(Number);
			const [endHour, endMinute] = end.split(':').map(Number);

			const startInMinutes = startHour * 60 + startMinute;
			const endInMinutes = endHour * 60 + endMinute;

			let excludedDuration;
			if (startInMinutes < endInMinutes) {
				excludedDuration = endInMinutes - startInMinutes;
			} else {
				excludedDuration = 1440 - startInMinutes + endInMinutes;
			}

			const allowedDuration = 1440 - excludedDuration;

			if (allowedDuration < 480) {
				Alert.alert(
					'Invalid Time Range',
					'Excluded time range leaves less than 8 hours for scheduling calls. Please adjust your times.',
					[{ text: 'OK' }]
				);
				setTimePickerVisible(false);
				return;
			}
		}

		// Only update the specific time range that passed validation
		tempTimes[index] = tempTimeRange;

		// Update states and Firestore only after validation passes
		setTimePickerVisible(false);
		setGlobalExcludedTimes(tempTimes);
		handleGlobalExcludedTimeChange(tempTimes);
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
		let options = type === 'minimum' ? DURATION_OPTIONS.minimumGap : DURATION_OPTIONS.optimalGap;

		// Filter options based on current values
		if (type === 'minimum') {
			options = options.filter((option) => option.value <= optimalGap);
		} else {
			options = options.filter((option) => option.value >= minGap);
		}

		// Check for empty options
		if (options.length === 0) {
			Alert.alert('No Valid Options', 'Please adjust the other gap time first to enable more options.', [
				{ text: 'OK' },
			]);
			return;
		}

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

	const showTimePicker = (index, timeType) => {
		setActiveTimePicker({ index, timeType });
		setTimePickerVisible(true);
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
					<Text style={[styles.label, { fontSize: 18, textAlign: 'center' }]}>Sleep Hours</Text>
					<Text
						style={[
							styles.settingText,
							{ fontSize: 14, color: colors.text.secondary, marginBottom: spacing.md, textAlign: 'center' },
						]}
					>
						Set your sleeping hours so calls are not scheduled during this time.
					</Text>

					<TouchableOpacity
						style={styles.settingItem}
						onPress={() => setExpandedSection(expandedSection === 'globalExcluded' ? null : 'globalExcluded')}
					>
						<View style={styles.settingItemLeft}>
							<Icon name="moon-outline" size={24} color={colors.text.secondary} />
							<Text style={[styles.settingText, { fontSize: 18 }]}>Pick Your Times</Text>
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
