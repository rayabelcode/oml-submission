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
			setRelationshipSettings(prefs.relationship_types || {});
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
				[timeType]: timeString,
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
                <TouchableOpacity 
                    style={[styles.settingItemLeft, { flex: 1 }]} 
                    onPress={() => navigation.goBack()}
                >
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
                                <Icon 
                                    name={icon} 
                                    size={24} 
                                    color={type === 'family' ? '#4A90E2' : 
                                           type === 'friend' ? '#E26B6B' :
                                           type === 'work' ? '#4CAF50' :
                                           '#9C27B0'} 
                                />
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
                                    startTime={relationshipSettings[type]?.activeHoursStart || '09:00'}
                                    endTime={relationshipSettings[type]?.activeHoursEnd || '17:00'}
                                    onStartTimePress={() => showTimePicker(type, 'activeHoursStart')}
                                    onEndTimePress={() => showTimePicker(type, 'activeHoursEnd')}
                                    label="Active Hours"
                                />
                                <DaySelector
                                    selectedDays={relationshipSettings[type]?.preferredDays || []}
                                    onDayPress={(day) => {
                                        const currentDays = relationshipSettings[type]?.preferredDays || [];
                                        const updatedDays = currentDays.includes(day)
                                            ? currentDays.filter((d) => d !== day)
                                            : [...currentDays, day];

                                        handleSettingsChange({
                                            ...relationshipSettings,
                                            [type]: {
                                                ...relationshipSettings[type],
                                                preferredDays: updatedDays,
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
                            relationshipSettings[activeTimePicker.type]?.[activeTimePicker.timeType]?.split(':')[0] || '9'
                        )
                        : 9
                }
                title={`Select ${activeTimePicker?.timeType === 'activeHoursStart' ? 'Start' : 'End'} Time`}
            />
        </View>
    );
};

export default RelationshipTypeSettings;
