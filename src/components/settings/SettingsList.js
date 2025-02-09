import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { useStyles } from '../../styles/screens/settings';
import Constants from 'expo-constants';
import * as Sharing from 'expo-sharing';

const SettingsList = ({
	notificationsEnabled,
	handleNotificationToggle,
	handleSupport,
	handleLogout,
	isDarkMode,
	handleThemeToggle,
	onProfilePress,
	onAccountPress,
	navigation,
}) => {
	const { colors } = useTheme();
	const styles = useStyles();

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
				<Text style={styles.sectionTitle}>User Settings</Text>
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
				<Text style={styles.sectionTitle}>App Settings</Text>
				<View style={styles.settingItem}>
					<View style={styles.settingItemLeft}>
						<Icon name="notifications-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Push Notifications</Text>
					</View>
					<Switch
						value={notificationsEnabled}
						onValueChange={handleNotificationToggle}
						trackColor={{ false: '#767577', true: '#81b0ff' }}
						thumbColor={notificationsEnabled ? colors.primary : '#f4f3f4'}
					/>
				</View>
				<View style={styles.settingItem}>
					<View style={styles.settingItemLeft}>
						<Icon name="moon-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Dark Mode</Text>
					</View>
					<Switch
						value={isDarkMode}
						onValueChange={handleThemeToggle}
						trackColor={{ false: '#767577', true: '#81b0ff' }}
						thumbColor={isDarkMode ? colors.primary : '#f4f3f4'}
					/>
				</View>
				<TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('Scheduling')}>
					<View style={styles.settingItemLeft}>
						<Icon name="time-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Scheduling Settings</Text>
					</View>
					<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
				</TouchableOpacity>
			</View>

			<View style={styles.settingSection}>
				<Text style={styles.sectionTitle}>Data | Privacy</Text>
				<TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('Privacy')}>
					<View style={styles.settingItemLeft}>
						<Icon name="lock-closed-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Privacy Settings</Text>
					</View>
					<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
				</TouchableOpacity>
			</View>

			<View style={styles.settingSection}>
				<Text style={styles.sectionTitle}>OnMyList</Text>
				<TouchableOpacity style={styles.settingItem} onPress={handleSupport}>
					<View style={styles.settingItemLeft}>
						<Icon name="mail-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Contact Support</Text>
					</View>
				</TouchableOpacity>

				<TouchableOpacity style={styles.settingItem} onPress={handleShare}>
					<View style={styles.settingItemLeft}>
						<Icon name="share-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Tell a Friend</Text>
					</View>
				</TouchableOpacity>
				<TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('About')}>
					<View style={styles.settingItemLeft}>
						<Icon name="information-circle-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>About</Text>
					</View>
					<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
				</TouchableOpacity>
			</View>
		</ScrollView>
	);
};

export default SettingsList;
