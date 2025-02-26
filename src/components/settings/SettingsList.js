import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { useStyles } from '../../styles/screens/settings';
import ThemePickerModal from '../modals/ThemePickerModal';
import * as Sharing from 'expo-sharing';

const SettingsList = ({
	notificationsEnabled,
	handleNotificationToggle,
	handleSupport,
	onProfilePress,
	onAccountPress,
	navigation,
	handleExportData,
	handleDeleteAccount,
}) => {
	const { colors, spacing } = useTheme();
	const styles = useStyles();
	const [showThemePicker, setShowThemePicker] = useState(false);

	const handleShare = async () => {
		try {
			await Sharing.shareAsync('https://onmylist.pro', {
				dialogTitle: 'Share OnMyList',
				message: 'Check out OnMyList - a better way to stay in touch with your network!',
			});
		} catch (error) {
			console.error('Error sharing:', error);
		}
	};

	return (
		<ScrollView style={styles.settingsList}>
			{/* Personal Information Card */}
			<View style={styles.settingsCard}>
				<Text style={styles.cardTitle}>Personal</Text>
				<View>
					{[
						{ icon: 'person-outline', text: 'Profile', onPress: onProfilePress },
						{ icon: 'lock-closed-outline', text: 'Account', onPress: onAccountPress },
					].map((item, index, array) => (
						<TouchableOpacity
							key={item.text}
							style={[styles.settingItem, index === array.length - 1 && { borderBottomWidth: 0 }]}
							onPress={item.onPress}
						>
							<View style={styles.settingItemLeft}>
								<Icon name={item.icon} size={20} color={colors.text.secondary} />
								<Text style={styles.settingText}>{item.text}</Text>
							</View>
							<View style={styles.settingItemRight}>
								<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
							</View>
						</TouchableOpacity>
					))}
				</View>
			</View>

			{/* Preferences Card */}
			<View style={styles.settingsCard}>
				<Text style={styles.cardTitle}>Preferences</Text>
				<View>
					{[
						{
							icon: 'time-outline',
							text: 'Scheduling',
							onPress: () => navigation.navigate('Scheduling'),
							showChevron: true,
						},
						{
							icon: 'notifications-outline',
							text: 'Notifications',
							onPress: () => navigation.navigate('NotificationSettings'),
							showChevron: true,
						},
						{
							icon: 'moon-outline',
							text: 'Theme',
							onPress: () => setShowThemePicker(true),
							showChevron: false,
						},
					].map((item, index, array) => (
						<TouchableOpacity
							key={item.text}
							style={[styles.settingItem, index === array.length - 1 && { borderBottomWidth: 0 }]}
							onPress={item.onPress}
						>
							<View style={styles.settingItemLeft}>
								<Icon name={item.icon} size={20} color={colors.text.secondary} />
								<Text style={styles.settingText}>{item.text}</Text>
							</View>
							{item.showChevron && (
								<View style={styles.settingItemRight}>
									<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
								</View>
							)}
						</TouchableOpacity>
					))}
				</View>
			</View>

			{/* Data & Privacy Card */}
			<View style={styles.settingsCard}>
				<Text style={styles.cardTitle}>Privacy | Data</Text>
				<View>
					{[
						{
							icon: 'shield-outline',
							text: 'Privacy & Data',
							onPress: () => navigation.navigate('Privacy'),
						},
					].map((item, index, array) => (
						<TouchableOpacity
							key={item.text}
							style={[styles.settingItem, index === array.length - 1 && { borderBottomWidth: 0 }]}
							onPress={item.onPress}
						>
							<View style={styles.settingItemLeft}>
								<Icon name={item.icon} size={20} color={colors.text.secondary} />
								<Text style={styles.settingText}>{item.text}</Text>
							</View>
							<View style={styles.settingItemRight}>
								<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
							</View>
						</TouchableOpacity>
					))}
				</View>
			</View>

			{/* About & Support Card */}
			<View style={styles.settingsCard}>
				<Text style={styles.cardTitle}>About</Text>
				<View>
					{[
						{
							icon: 'information-circle-outline',
							text: 'About OnMyList',
							onPress: () => navigation.navigate('About'),
							showChevron: true,
						},
						{
							icon: 'share-social-outline',
							text: 'Tell a Friend',
							onPress: handleShare,
							showChevron: false,
						},
						{
							icon: 'mail-outline',
							text: 'Support',
							onPress: handleSupport,
							showChevron: false,
						},
					].map((item, index, array) => (
						<TouchableOpacity
							key={item.text}
							style={[styles.settingItem, index === array.length - 1 && { borderBottomWidth: 0 }]}
							onPress={item.onPress}
						>
							<View style={styles.settingItemLeft}>
								<Icon name={item.icon} size={20} color={colors.text.secondary} />
								<Text style={styles.settingText}>{item.text}</Text>
							</View>
							{item.showChevron && (
								<View style={styles.settingItemRight}>
									<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
								</View>
							)}
						</TouchableOpacity>
					))}
				</View>
			</View>

			<ThemePickerModal visible={showThemePicker} onClose={() => setShowThemePicker(false)} />
		</ScrollView>
	);
};

export default SettingsList;
