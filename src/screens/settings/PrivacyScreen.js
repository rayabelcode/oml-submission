import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useStyles } from '../../styles/screens/settings';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportUserData, deleteUserAccount } from '../../utils/firestore';

const PrivacyScreen = ({ navigation }) => {
	const styles = useStyles();
	const { colors } = useTheme();
	const { user, signOut } = useAuth();

	const handleExport = async (contactsOnly) => {
		try {
			const userData = await exportUserData(user.uid);
			const fileName = contactsOnly ? 'onmylist_export_contacts.csv' : 'onmylist_export_full.csv';
			const fileUri = `${FileSystem.documentDirectory}${fileName}`;

			let csvContent = contactsOnly
				? 'First Name,Last Name,Phone\n'
				: 'First Name,Last Name,Email,Phone,Tags,Next Contact,Notes,Contact History\n';

			userData.contacts.forEach((contact) => {
				if (contactsOnly) {
					csvContent += `"${contact.first_name || ''}","${contact.last_name || ''}","${
						contact.phone || ''
					}"\n`;
				} else {
					const historyString =
						contact.contact_history
							?.map((h) => `${new Date(h.date).toLocaleDateString()}: ${h.notes.replace(/"/g, '""')}`)
							.join('; ') || '';

					csvContent += `"${contact.first_name || ''}","${contact.last_name || ''}","${
						contact.email || ''
					}","${contact.phone || ''}","${contact.tags?.join(';') || ''}","${contact.next_contact || ''}","${(
						contact.notes || ''
					).replace(/"/g, '""')}","${historyString}"\n`;
				}
			});

			await FileSystem.writeAsStringAsync(fileUri, csvContent);

			if (Platform.OS === 'ios') {
				await Sharing.shareAsync(fileUri);
			} else {
				await Sharing.shareAsync(fileUri, {
					mimeType: 'text/csv',
					dialogTitle: `Export OnMyList ${contactsOnly ? 'Contacts' : 'Full'} Data`,
				});
			}
		} catch (error) {
			console.error('Error exporting data:', error);
			Alert.alert('Error', 'Failed to export data');
		}
	};

	const handleDelete = () => {
		Alert.alert(
			'Delete Account',
			'Are you sure you want to delete your account? This action cannot be undone and will delete all your contacts and data.',
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Delete',
					style: 'destructive',
					onPress: async () => {
						try {
							await deleteUserAccount(user.uid);
							await user.delete();
							await signOut();
						} catch (error) {
							console.error('Error deleting account:', error);
							Alert.alert('Error', 'Failed to delete account');
						}
					},
				},
			]
		);
	};

	return (
		<View style={styles.container}>
			<View style={styles.headerSettingsPages}>
				<TouchableOpacity style={styles.settingItemLeft} onPress={() => navigation.goBack()}>
					<Icon name="chevron-back" size={24} color={colors.text.primary} />
					<Text style={[styles.profileName, { fontSize: 20 }]}>Data | Privacy</Text>
				</TouchableOpacity>
			</View>

			<ScrollView style={styles.settingsList}>
				<View style={styles.formSection}>
					<View style={styles.inputGroup}>
						<Text style={[styles.label, { fontSize: 18 }]}>Export Data</Text>
						<TouchableOpacity style={styles.settingItem} onPress={() => handleExport(false)}>
							<View style={styles.settingItemLeft}>
								<Icon name="download-outline" size={24} color={colors.text.secondary} />
								<Text style={[styles.settingText, { fontSize: 18, marginLeft: 15 }]}>Export All Data</Text>
							</View>
						</TouchableOpacity>
						<TouchableOpacity style={styles.settingItem} onPress={() => handleExport(true)}>
							<View style={styles.settingItemLeft}>
								<Icon name="people-outline" size={24} color={colors.text.secondary} />
								<Text style={[styles.settingText, { fontSize: 18, marginLeft: 15 }]}>
									Export Contacts Only
								</Text>
							</View>
						</TouchableOpacity>
					</View>

					<View style={[styles.inputGroup, { marginTop: 30 }]}>
						<Text style={[styles.label, { fontSize: 18 }]}>Delete Account</Text>
						<Text
							style={[
								styles.settingText,
								{
									color: colors.danger,
									marginBottom: 20,
									fontSize: 16,
									lineHeight: 22,
								},
							]}
						>
							Warning: This action cannot be undone. All your contacts, history, and personal data will be
							permanently deleted.
						</Text>
						<TouchableOpacity
							style={[styles.settingItem, { borderTopWidth: 1, borderTopColor: colors.border }]}
							onPress={handleDelete}
						>
							<View style={styles.settingItemLeft}>
								<Icon name="trash-outline" size={24} color={colors.danger} />
								<Text
									style={[
										styles.settingText,
										{
											color: colors.danger,
											fontSize: 18,
											marginLeft: 15,
										},
									]}
								>
									Delete Account
								</Text>
							</View>
						</TouchableOpacity>
					</View>
				</View>
			</ScrollView>
		</View>
	);
};

export default PrivacyScreen;
