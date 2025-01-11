import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useStyles } from '../../styles/screens/settings';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { getUserPreferences, updateUserPreferences } from '../../utils/preferences';
import TimeRangeSelector from '../../components/settings/TimeRangeSelector';
import DaySelector from '../../components/settings/DaySelector';
import TimePickerModal from '../../components/modals/TimePickerModal';
import { RELATIONSHIP_TYPES } from '../../../constants/relationships';

const DEFAULT_ACTIVE_HOURS = {
	work: { start: '09:00', end: '17:00' },
	personal: { start: '17:00', end: '21:00' },
	family: { start: '10:00', end: '21:00' },
	friend: { start: '17:00', end: '21:00' },
};

const RelationshipTypeSettings = ({ navigation }) => {
	const styles = useStyles();
	const { colors, spacing } = useTheme();
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [expandedType, setExpandedType] = useState(null);
	const [relationshipSettings, setRelationshipSettings] = useState({});
	const [timePickerVisible, setTimePickerVisible] = useState(false);
	const [activeTimePicker, setActiveTimePicker] = useState(null);

	useEffect(() => {
		loadPreferences();
	}, [user.uid]);

	const loadPreferences = async () => {
		try {
			const prefs = await getUserPreferences(user.uid);
			const initializedSettings = {};
			Object.keys(RELATIONSHIP_TYPES).forEach((type) => {
				initializedSettings[type] = {
					active_hours: {
						start: prefs[type]?.active_hours?.start || DEFAULT_ACTIVE_HOURS[type].start,
						end: prefs[type]?.active_hours?.end || DEFAULT_ACTIVE_HOURS[type].end,
					},
					preferred_days: prefs[type]?.preferred_days || [],
					excluded_times: prefs[type]?.excluded_times || [],
				};
			});
			setRelationshipSettings(initializedSettings);
			setLoading(false);
		} catch (error) {
			console.error('Error loading preferences:', error);
			setLoading(false);
		}
	};

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

	const handleSettingsChange = async (updatedSettings) => {
		try {
			setRelationshipSettings(updatedSettings);
			await updateUserPreferences(user.uid, {
				relationship_types: updatedSettings,
			});
		} catch (error) {
			console.error('Error updating relationship settings:', error);
		}
	};

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
				{Object.entries(RELATIONSHIP_TYPES).map(([type, { label, icon, color }]) => (
					<View
						key={type}
						style={[styles.formSection, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
					>
						<TouchableOpacity
							activeOpacity={1}
							style={[styles.settingItem, { paddingVertical: 15 }]}
							onPress={() => setExpandedType(expandedType === type ? null : type)}
						>
							<View style={styles.settingItemLeft}>
								<Icon name={icon} size={24} color={RELATIONSHIP_TYPES[type].color} />
								<Text style={[styles.settingText, { fontSize: 18, marginLeft: 15 }]}>{label}</Text>
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
									startTime={
										relationshipSettings[type]?.active_hours?.start || DEFAULT_ACTIVE_HOURS[type].start
									}
									endTime={relationshipSettings[type]?.active_hours?.end || DEFAULT_ACTIVE_HOURS[type].end}
									onStartTimePress={() => showTimePicker(type, 'activeHoursStart')}
									onEndTimePress={() => showTimePicker(type, 'activeHoursEnd')}
									label="Active Hours"
								/>
								<DaySelector
									selectedDays={relationshipSettings[type]?.preferred_days || []}
									onDayPress={(day) => {
										const currentDays = relationshipSettings[type]?.preferred_days || [];
										const updatedDays = currentDays.includes(day)
											? currentDays.filter((d) => d !== day)
											: [...currentDays, day];

										handleSettingsChange({
											...relationshipSettings,
											[type]: {
												...relationshipSettings[type],
												preferred_days: updatedDays,
											},
										});
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
					activeTimePicker
						? parseInt(
								relationshipSettings[activeTimePicker.type]?.active_hours?.[
									activeTimePicker.timeType === 'activeHoursStart' ? 'start' : 'end'
								]?.split(':')[0] ||
									DEFAULT_ACTIVE_HOURS[activeTimePicker.type][
										activeTimePicker.timeType === 'activeHoursStart' ? 'start' : 'end'
									].split(':')[0]
						  )
						: 9
				}
				title={`Select ${activeTimePicker?.timeType === 'activeHoursStart' ? 'Start' : 'End'} Time`}
			/>
		</View>
	);
};

export default RelationshipTypeSettings;
