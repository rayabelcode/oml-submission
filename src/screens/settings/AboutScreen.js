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
						<Text style={styles.cardTitleCenter}>App Information</Text>
						<View>
							{[
								{
									text: 'Version',
									value: Constants.expoConfig.version,
									type: 'text',
								},
								{
									text: 'Developer',
									value: 'Ray Abel',
									type: 'text',
								},
								{
									text: 'Website',
									value: 'onmylist.pro',
									type: 'link',
									onPress: () => Linking.openURL('https://onmylist.pro'),
								},
							].map((item, index, array) =>
								item.type === 'link' ? (
									<TouchableOpacity
										key={item.text}
										style={[styles.settingItem, index === array.length - 1 && { borderBottomWidth: 0 }]}
										onPress={item.onPress}
									>
										<Text style={styles.settingText}>{item.text}</Text>
										<Text style={[styles.settingText, { color: colors.primary }]}>{item.value}</Text>
									</TouchableOpacity>
								) : (
									<View
										key={item.text}
										style={[styles.settingItem, index === array.length - 1 && { borderBottomWidth: 0 }]}
									>
										<Text style={styles.settingText}>{item.text}</Text>
										<Text style={[styles.settingText, { color: colors.text.secondary }]}>{item.value}</Text>
									</View>
								)
							)}
						</View>
					</View>
				</View>

				<View style={[styles.formSection, styles.card]}>
					<View style={[styles.settingSection, { borderBottomWidth: 0 }]}>
						<Text style={styles.cardTitleCenter}>Legal & Privacy</Text>
						<View>
							{[
								{
									text: 'Terms',
									onPress: () => Linking.openURL('https://onmylist.pro/terms'),
								},
								{
									text: 'Privacy Policy',
									onPress: () => Linking.openURL('https://onmylist.pro/privacy'),
								},
							].map((item, index, array) => (
								<TouchableOpacity
									key={item.text}
									style={[styles.settingItem, index === array.length - 1 && { borderBottomWidth: 0 }]}
									onPress={item.onPress}
								>
									<Text style={styles.settingText}>{item.text}</Text>
									<Icon name="open-outline" size={20} color={colors.primary} />
								</TouchableOpacity>
							))}
						</View>
					</View>
				</View>
			</ScrollView>
		</View>
	);
};

export default AboutScreen;
