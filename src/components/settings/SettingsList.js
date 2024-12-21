import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../styles/theme';
import styles from '../../styles/screens/settings';

const SettingsList = ({
	notificationsEnabled,
	handleNotificationToggle,
	setIsPrivacyModalVisible,
	handleSupport,
	handleLogout,
}) => (
	<ScrollView style={styles.settingsList}>
		<View style={styles.settingSection}>
			<Text style={styles.sectionTitle}>Notifications</Text>
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
		</View>

		<View style={styles.settingSection}>
			<Text style={styles.sectionTitle}>Privacy</Text>
			<TouchableOpacity style={styles.settingItem} onPress={() => setIsPrivacyModalVisible(true)}>
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
					<Icon name="help-circle-outline" size={20} color={colors.text.secondary} />
					<Text style={styles.settingText}>Help Center</Text>
				</View>
				<Icon name="chevron-forward-outline" size={20} color={colors.text.secondary} />
			</TouchableOpacity>
		</View>

		<TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
			<Icon name="log-out-outline" size={20} color={colors.danger} />
			<Text style={styles.logoutText}>Log Out</Text>
		</TouchableOpacity>
	</ScrollView>
);

export default SettingsList;
