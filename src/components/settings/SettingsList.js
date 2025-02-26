import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { useStyles } from '../../styles/screens/settings';
import ThemePickerModal from '../modals/ThemePickerModal';
import Constants from 'expo-constants';
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
				<TouchableOpacity style={styles.settingItem} onPress={onProfilePress}>
					<View style={styles.settingItemLeft}>
						<Icon name="person-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Profile Information</Text>
					</View>
					<View style={styles.settingItemRight}>
						<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
					</View>
				</TouchableOpacity>

				<TouchableOpacity style={styles.settingItemLast} onPress={onAccountPress}>
					<View style={styles.settingItemLeft}>
						<Icon name="at-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Account & Security</Text>
					</View>
					<View style={styles.settingItemRight}>
						<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
					</View>
				</TouchableOpacity>
			</View>

			{/* Preferences Card */}
			<View style={styles.settingsCard}>
				<Text style={styles.cardTitle}>Preferences</Text>
				<TouchableOpacity
					style={styles.settingItem}
					onPress={() => navigation.navigate('NotificationSettings')}
				>
					<View style={styles.settingItemLeft}>
						<Icon name="notifications-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Notifications</Text>
					</View>
					<View style={styles.settingItemRight}>
						<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
					</View>
				</TouchableOpacity>

				<TouchableOpacity style={styles.settingItem} onPress={() => setShowThemePicker(true)}>
					<View style={styles.settingItemLeft}>
						<Icon name="moon-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Theme</Text>
					</View>
					<View style={styles.settingItemRight}>
						<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
					</View>
				</TouchableOpacity>

				<TouchableOpacity style={styles.settingItemLast} onPress={() => navigation.navigate('Scheduling')}>
					<View style={styles.settingItemLeft}>
						<Icon name="time-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Scheduling</Text>
					</View>
					<View style={styles.settingItemRight}>
						<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
					</View>
				</TouchableOpacity>
			</View>

			{/* Data & Privacy Card */}
			<View style={styles.settingsCard}>
				<Text style={styles.cardTitle}>Data & Privacy</Text>
				<TouchableOpacity style={styles.settingItemLast} onPress={() => navigation.navigate('Privacy')}>
					<View style={styles.settingItemLeft}>
						<Icon name="shield-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Privacy & Data</Text>
					</View>
					<View style={styles.settingItemRight}>
						<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
					</View>
				</TouchableOpacity>
			</View>

			{/* About & Support Card */}
			<View style={styles.settingsCard}>
				<Text style={styles.cardTitle}>About & Support</Text>
				<TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('About')}>
					<View style={styles.settingItemLeft}>
						<Icon name="information-circle-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>About OnMyList</Text>
					</View>
					<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
				</TouchableOpacity>

				<TouchableOpacity style={styles.settingItem} onPress={handleShare}>
					<View style={styles.settingItemLeft}>
						<Icon name="share-social-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Tell a Friend</Text>
					</View>
					<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
				</TouchableOpacity>

				<TouchableOpacity style={styles.settingItemLast} onPress={handleSupport}>
					<View style={styles.settingItemLeft}>
						<Icon name="mail-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Support</Text>
					</View>
					<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
				</TouchableOpacity>
			</View>

			<ThemePickerModal visible={showThemePicker} onClose={() => setShowThemePicker(false)} />
		</ScrollView>
	);
};

export default SettingsList;
