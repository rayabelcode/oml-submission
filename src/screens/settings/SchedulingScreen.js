import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, ActionSheetIOS, Alert } from 'react-native';
import { useStyles } from '../../styles/screens/settings';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { getUserPreferences, updateUserPreferences } from '../../utils/preferences';

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
	const { colors } = useTheme();
	const { user } = useAuth();
	const [minGap, setMinGap] = useState(DEFAULT_MIN_GAP);
	const [optimalGap, setOptimalGap] = useState(DEFAULT_OPTIMAL_GAP);

	useEffect(() => {
		const loadPreferences = async () => {
			try {
				const prefs = await getUserPreferences(user.uid);
				setMinGap(prefs.minimumGapMinutes || DEFAULT_MIN_GAP);
				setOptimalGap(prefs.optimalGapMinutes || DEFAULT_OPTIMAL_GAP);
			} catch (error) {
				console.error('Error loading preferences:', error);
			}
		};
		loadPreferences();
	}, [user.uid]);

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
			setMinGap(minGap); // Revert on error
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
			setOptimalGap(optimalGap); // Revert on error
			Alert.alert('Error', 'Failed to update optimal gap');
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
			</ScrollView>
		</View>
	);
};

export default SchedulingScreen;
