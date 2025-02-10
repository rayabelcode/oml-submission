import React, { useState, useEffect } from 'react';
import { View, Text, Switch, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useStyles } from '../../styles/screens/settings';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateUserProfile } from '../../utils/firestore';
import Icon from 'react-native-vector-icons/Ionicons';

export default function NotificationSettingsScreen() {
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
				<Text style={styles.sectionTitle}>Cloud Notifications</Text>
				<Text style={styles.sectionDescription}>
					Receive notifications for scheduled reminders and custom date reminders. These help you stay on top
					of your planned check-ins and important dates.
				</Text>
				<View style={styles.settingItem}>
					<View style={styles.settingItemLeft}>
						<Text style={styles.settingText}>Enable Cloud Notifications</Text>
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
				<Text style={styles.sectionTitle}>Local Notifications</Text>
				<Text style={styles.sectionDescription}>
					Receive follow-up reminders after phone calls to help you track conversations and maintain notes
					about your interactions.
				</Text>
				<View style={styles.settingItem}>
					<View style={styles.settingItemLeft}>
						<Text style={styles.settingText}>Enable Local Notifications</Text>
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
