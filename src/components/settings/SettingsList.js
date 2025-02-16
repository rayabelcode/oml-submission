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
	const { colors } = useTheme();
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
			<View style={styles.settingSection}>
				<Text style={styles.mainSettingTitle}>User Settings</Text>
				<TouchableOpacity style={styles.settingItem} onPress={onProfilePress}>
					<View style={styles.settingItemLeft}>
						<Icon name="person-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Profile</Text>
					</View>
					<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
				</TouchableOpacity>
				<TouchableOpacity style={styles.settingItem} onPress={onAccountPress}>
					<View style={styles.settingItemLeft}>
						<Icon name="lock-closed-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Account</Text>
					</View>
					<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
				</TouchableOpacity>
			</View>

			<View style={styles.settingSection}>
				<Text style={styles.mainSettingTitle}>Scheduler</Text>
				<TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('Scheduling')}>
					<View style={styles.settingItemLeft}>
						<Icon name="time-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Scheduling Settings</Text>
					</View>
					<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
				</TouchableOpacity>
			</View>

			<View style={styles.settingSection}>
				<Text style={styles.mainSettingTitle}>App Settings</Text>
				<TouchableOpacity
					style={styles.settingItem}
					onPress={() => navigation.navigate('NotificationSettings')}
				>
					<View style={styles.settingItemLeft}>
						<Icon name="notifications-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Notification Settings</Text>
					</View>
					<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
				</TouchableOpacity>

				<TouchableOpacity style={styles.settingItem} onPress={() => setShowThemePicker(true)}>
					<View style={styles.settingItemLeft}>
						<Icon name="moon-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Theme</Text>
					</View>
				</TouchableOpacity>
			</View>

			<View style={styles.settingSection}>
				<Text style={styles.mainSettingTitle}>Data | Privacy</Text>
				<TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('Privacy')}>
					<View style={styles.settingItemLeft}>
						<Icon name="lock-closed-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Privacy and Export</Text>
					</View>
					<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
				</TouchableOpacity>
			</View>

			<View style={styles.settingSection}>
				<Text style={styles.mainSettingTitle}>OnMyList</Text>

				<TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('About')}>
					<View style={styles.settingItemLeft}>
						<Icon name="information-circle-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>About</Text>
					</View>
					<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
				</TouchableOpacity>

				<TouchableOpacity style={styles.settingItem} onPress={handleShare}>
					<View style={styles.settingItemLeft}>
						<Icon name="share-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Tell a Friend</Text>
					</View>
				</TouchableOpacity>

				<TouchableOpacity style={styles.settingItem} onPress={handleSupport}>
					<View style={styles.settingItemLeft}>
						<Icon name="mail-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Support</Text>
					</View>
				</TouchableOpacity>
			</View>

			<ThemePickerModal visible={showThemePicker} onClose={() => setShowThemePicker(false)} />
		</ScrollView>
	);
};

export default SettingsList;
