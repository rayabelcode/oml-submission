import React, { useState, useEffect } from 'react';
import { View, Text, Switch, TouchableOpacity, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { spacing, layout, useTheme } from '../../context/ThemeContext';
import { useStyles } from '../../styles/screens/settings';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateUserProfile } from '../../utils/firestore';
import Icon from 'react-native-vector-icons/Ionicons';

export default function NotificationSettingsScreen() {
	const navigation = useNavigation();
	const { colors } = useTheme();
	const styles = useStyles();
	const { user } = useAuth();
	const [localNotifications, setLocalNotifications] = useState(false);

	useEffect(() => {
		loadNotificationSettings();
	}, []);

	const loadNotificationSettings = async () => {
		try {
			const localEnabled = await AsyncStorage.getItem('localNotificationsEnabled');

			// Set default states immediately for UI responsiveness (Default to true unless explicitly false)
			setLocalNotifications(localEnabled !== 'false');

			// Handle first-time setup or missing settings
			if (localEnabled === null) {
				await Promise.all([
					AsyncStorage.setItem('localNotificationsEnabled', 'true'),
					updateUserProfile(user.uid, { local_notifications_enabled: true }),
				]);
			}
		} catch (error) {
			console.error('Error loading notification settings:', error);
			// Set defaults even if there's an error
			setLocalNotifications(true);
		}
	};

	const handleLocalNotificationToggle = async () => {
		const newState = !localNotifications;
		setLocalNotifications(newState);
		await AsyncStorage.setItem('localNotificationsEnabled', String(newState));
		await updateUserProfile(user.uid, { local_notifications_enabled: newState });
	};

	const openNotificationSettings = () => {
		Linking.openSettings();
	};

	return (
		<View style={styles.container}>
			<View style={styles.headerSettingsPages}>
				<TouchableOpacity style={styles.settingItemLeft} onPress={() => navigation.goBack()}>
					<Icon name="chevron-back" size={24} color={colors.text.primary} />
					<Text style={[styles.profileName, { fontSize: 20 }]}>Notifications</Text>
				</TouchableOpacity>
			</View>

			<View style={styles.settingSection}>
				<View style={styles.sectionHeader}>
					<View style={styles.iconTitleContainer}>
						<Icon name="calendar-outline" size={24} color={colors.primary} style={styles.sectionIcon} />
						<Text style={styles.notificationTitle}>Scheduled Reminders</Text>
					</View>
				</View>
				<Text style={styles.sectionDescription}>
					Manage your scheduled reminder notifications in your device settings.
				</Text>
				<TouchableOpacity
					style={[
						{
							backgroundColor: colors.background.secondary,
							borderRadius: layout.borderRadius.md,
							borderWidth: 1,
							borderColor: colors.primary,
							marginTop: spacing.md,
							marginBottom: spacing.md,
							padding: spacing.sm,
							alignSelf: 'center',
						},
					]}
					onPress={openNotificationSettings}
				>
					<Text
						style={[
							styles.settingText,
							{
								color: colors.primary,
								marginLeft: 0,
								paddingHorizontal: spacing.md,
							},
						]}
					>
						Open System Settings
					</Text>
				</TouchableOpacity>
			</View>

			<View style={styles.settingSection}>
				<View style={styles.sectionHeader}>
					<View style={styles.iconTitleContainer}>
						<Icon name="call-outline" size={24} color={colors.primary} style={styles.sectionIcon} />
						<Text style={styles.notificationTitle}>Call Follow-Ups</Text>
					</View>
				</View>
				<Text style={styles.sectionDescription}>
					Get helpful reminders after phone calls to update your notes and track recent conversations.
				</Text>
				<View style={styles.settingItem}>
					<View style={styles.settingItemLeft}>
						<Text style={styles.settingText}>Enable Follow-up Reminders</Text>
					</View>
					<Switch
						value={localNotifications}
						onValueChange={handleLocalNotificationToggle}
						trackColor={{ false: '#767577', true: '#81b0ff' }}
						thumbColor={localNotifications ? colors.primary : '#f4f3f4'}
					/>
				</View>
			</View>
		</View>
	);
}
