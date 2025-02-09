import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { useStyles } from '../../styles/screens/settings';
import Constants from 'expo-constants';

const AboutScreen = ({ navigation }) => {
	const { colors } = useTheme();
	const styles = useStyles();

	return (
		<View style={styles.container}>
			<View style={styles.headerSettingsPages}>
				<TouchableOpacity style={styles.settingItemLeft} onPress={() => navigation.goBack()}>
					<Icon name="chevron-back" size={24} color={colors.text.primary} />
					<Text style={[styles.profileName, { fontSize: 20 }]}>About</Text>
				</TouchableOpacity>
			</View>

			<ScrollView style={styles.settingsList}>
				<View style={[styles.formSection, styles.card]}>
					<View style={[styles.settingSection, { borderBottomWidth: 0 }]}>
						<Text style={styles.sectionTitle}>App Information</Text>
						<View style={styles.settingItem}>
							<Text style={styles.settingText}>Version</Text>
							<Text style={[styles.settingText, { color: colors.text.secondary }]}>
								{Constants.expoConfig.version}
							</Text>
						</View>
						<View style={styles.settingItem}>
							<Text style={styles.settingText}>Developer</Text>
							<Text style={[styles.settingText, { color: colors.text.secondary }]}>Ray Abel</Text>
						</View>
						<TouchableOpacity
							style={styles.settingItem}
							onPress={() => Linking.openURL('https://onmylist.pro')}
						>
							<Text style={styles.settingText}>Website</Text>
							<Text style={[styles.settingText, { color: colors.primary }]}>onmylist.pro</Text>
						</TouchableOpacity>
					</View>

					<View style={[styles.settingSection, { borderBottomWidth: 0 }]}>
						<Text style={styles.sectionTitle}>Legal & Privacy</Text>
						<TouchableOpacity
							style={styles.settingItem}
							onPress={() => Linking.openURL('https://onmylist.pro/privacy')}
						>
							<Text style={styles.settingText}>Privacy Policy</Text>
							<Icon name="open-outline" size={20} color={colors.primary} />
						</TouchableOpacity>
					</View>
				</View>
			</ScrollView>
		</View>
	);
};

export default AboutScreen;
