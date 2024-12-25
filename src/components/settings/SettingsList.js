import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { useStyles } from '../../styles/screens/settings';

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
				<Text style={styles.sectionTitle}>Support</Text>
				<TouchableOpacity style={styles.settingItem} onPress={handleSupport}>
					<View style={styles.settingItemLeft}>
						<Icon name="mail-outline" size={20} color={colors.text.secondary} />
						<Text style={styles.settingText}>Help Center</Text>
					</View>
				</TouchableOpacity>
			</View>

			<TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
				<Icon name="log-out-outline" size={20} color={colors.danger} />
				<Text style={styles.logoutText}>Log Out</Text>
			</TouchableOpacity>
		</ScrollView>
	);
};

export default SettingsList;
