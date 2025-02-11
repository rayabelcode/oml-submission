import React, { useState, useEffect } from 'react';
import { View, Text, Switch, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useStyles } from '../../styles/screens/settings';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateUserProfile } from '../../utils/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import * as Notifications from 'expo-notifications';
import { REMINDER_STATUS } from '../../../constants/notificationConstants';
import { reminderSync } from '../../utils/notifications/reminderSync';

export default function NotificationSettingsScreen() {
	const navigation = useNavigation();
	const { colors } = useTheme();
	const styles = useStyles();
	const { user } = useAuth();
	const [cloudNotifications, setCloudNotifications] = useState(false);
	const [localNotifications, setLocalNotifications] = useState(false);

	useEffect(() => {
		loadNotificationSettings();
	}, []);

	const loadNotificationSettings = async () => {
		const [cloudEnabled, localEnabled] = await Promise.all([
			AsyncStorage.getItem('cloudNotificationsEnabled'),
			AsyncStorage.getItem('localNotificationsEnabled'),
		]);
		setCloudNotifications(cloudEnabled === 'true');
		setLocalNotifications(localEnabled === 'true');
	};

	const handleCloudNotificationToggle = async () => {
		const newState = !cloudNotifications;
		setCloudNotifications(newState);
		await AsyncStorage.setItem('cloudNotificationsEnabled', String(newState));
		await updateUserProfile(user.uid, { cloud_notifications_enabled: newState });

		if (newState) {
			// Reactivate notifications for all existing future reminders
			const remindersRef = collection(db, 'reminders');
			const q = query(
				remindersRef,
				where('user_id', '==', user.uid),
				where('status', '==', REMINDER_STATUS.PENDING)
			);

			const snapshot = await getDocs(q);
			for (const doc of snapshot.docs) {
				const reminder = { id: doc.id, ...doc.data() };
				await reminderSync.scheduleLocalNotification(reminder);
			}
		} else {
			// Cancel all pending cloud notifications (scheduled & custom date reminders)
			const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
			for (const notification of scheduledNotifications) {
				if (
					notification.content.data?.type === 'SCHEDULED' ||
					notification.content.data?.type === 'CUSTOM_DATE'
				) {
					await Notifications.cancelScheduledNotificationAsync(notification.identifier);
				}
			}
		}
	};

	const handleLocalNotificationToggle = async () => {
		const newState = !localNotifications;
		setLocalNotifications(newState);
		await AsyncStorage.setItem('localNotificationsEnabled', String(newState));
		await updateUserProfile(user.uid, { local_notifications_enabled: newState });
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
					Receive notifications for upcoming check-ins and important dates.
				</Text>
				<View style={styles.settingItem}>
					<View style={styles.settingItemLeft}>
						<Text style={styles.settingText}>Enable Scheduled Reminders</Text>
					</View>
					<Switch
						value={cloudNotifications}
						onValueChange={handleCloudNotificationToggle}
						trackColor={{ false: '#767577', true: '#81b0ff' }}
						thumbColor={cloudNotifications ? colors.primary : '#f4f3f4'}
					/>
				</View>
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
