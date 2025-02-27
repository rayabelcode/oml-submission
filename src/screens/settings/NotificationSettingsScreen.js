import React, { useState, useEffect } from 'react';
import { View, Text, Switch, TouchableOpacity, Linking, ScrollView } from 'react-native';
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
			<View style={styles.screenHeader}>
				<TouchableOpacity style={styles.headerBackButton} onPress={() => navigation.goBack()}>
					<Icon name="chevron-back" size={24} color={colors.text.primary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Notifications</Text>
				<View style={styles.headerRightPlaceholder} />
			</View>

			<ScrollView>
				{/* Scheduled Reminders Card */}
				<View style={styles.settingsCard}>
					<Text style={styles.cardTitleCenter}>Scheduled Reminders</Text>
					<Text style={styles.cardDescription}>
						Manage your scheduled reminder notifications in your device settings.
					</Text>

					<TouchableOpacity
						style={{
							backgroundColor: colors.background.primary,
							borderRadius: layout.borderRadius.md,
							paddingVertical: spacing.sm,
							paddingHorizontal: spacing.lg,
							alignSelf: 'center',
							borderWidth: 1,
							borderColor: colors.primary,
							marginVertical: spacing.sm,
						}}
						onPress={openNotificationSettings}
					>
						<Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>
							Open System Settings
						</Text>
					</TouchableOpacity>
				</View>

				{/* Call Follow-Ups Card */}
				<View style={styles.settingsCard}>
					<Text style={styles.cardTitleCenter}>Call Follow-Ups</Text>
					<Text style={styles.cardDescription}>
						Get reminders after calls to update notes.
					</Text>

					<View>
						{[
							{
								icon: 'call-outline',
								text: 'Enable Follow-Ups',
								component: (
									<Switch
										value={localNotifications}
										onValueChange={handleLocalNotificationToggle}
										trackColor={{ false: '#767577', true: '#81b0ff' }}
										thumbColor={localNotifications ? colors.primary : '#f4f3f4'}
									/>
								),
							},
						].map((item, index, array) => (
							<View
								key={item.text}
								style={[styles.settingItem, index === array.length - 1 && { borderBottomWidth: 0 }]}
							>
								<View style={styles.settingItemLeft}>
									<Icon name={item.icon} size={24} color={colors.text.secondary} />
									<Text style={styles.settingText}>{item.text}</Text>
								</View>
								{item.component}
							</View>
						))}
					</View>
				</View>

				{/* Info Banner */}
				<View style={styles.infoBanner}>
					<Icon name="information-circle-outline" size={24} color={colors.primary} />
					<Text style={styles.infoBannerText}>
					Follow-Up reminders help you track conversations by prompting you to update notes after calls.
					</Text>
				</View>
			</ScrollView>
		</View>
	);
}
