import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useStyles } from '../../styles/screens/settings';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as AppleAuthentication from 'expo-apple-authentication';
import { exportUserData, deleteUserAccount, cleanupSubscriptions } from '../../utils/firestore';
import { EmailAuthProvider, OAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

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

			await Sharing.shareAsync(fileUri);
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
					onPress: () => {
						if (user.providerData[0]?.providerId === 'apple.com') {
							handleAccountDeletion();
						} else {
							Alert.prompt(
								'Enter Password',
								'Please enter your password to confirm deletion',
								[
									{ text: 'Cancel', style: 'cancel' },
									{
										text: 'Delete',
										style: 'destructive',
										onPress: async (password) => {
											if (!password) {
												Alert.alert('Error', 'Password is required');
												return;
											}

											try {
												const credential = EmailAuthProvider.credential(user.email, password);
												await reauthenticateWithCredential(user, credential);
												await handleAccountDeletion();
											} catch (error) {
												console.error('Error deleting account:', error);
												Alert.alert(
													'Error',
													error.code === 'auth/wrong-password'
														? 'Incorrect password'
														: 'Failed to delete account'
												);
											}
										},
									},
								],
								'secure-text'
							);
						}
					},
				},
			]
		);
	};

	const handleAccountDeletion = async () => {
		try {
			if (user.providerData[0]?.providerId === 'apple.com') {
				Alert.alert('Verify Identity', 'Please verify your Apple ID to continue with account deletion.', [
					{ text: 'Cancel', style: 'cancel' },
					{
						text: 'Continue',
						style: 'destructive',
						onPress: async () => {
							try {
								cleanupSubscriptions();

								const appleCredential = await AppleAuthentication.signInAsync({
									requestedScopes: [
										AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
										AppleAuthentication.AppleAuthenticationScope.EMAIL,
									],
								});

								const provider = new OAuthProvider('apple.com');
								const credential = provider.credential({
									idToken: appleCredential.identityToken,
									rawNonce: appleCredential.nonce,
								});

								await reauthenticateWithCredential(user, credential);

								await deleteUserAccount(user.uid);
								await user.delete();
								await signOut();
							} catch (error) {
								console.error('Error during verification:', error);
								Alert.alert('Error', 'Failed to verify identity. Please try again.');
							}
						},
					},
				]);
			} else {
				cleanupSubscriptions();
				await deleteUserAccount(user.uid);
				await user.delete();
				await signOut();
			}
		} catch (error) {
			console.error('Error deleting account:', error);
			Alert.alert('Error', 'Failed to delete account. Please try signing out and back in, then try again.');
		}
	};

	return (
		<View style={styles.container}>
			{/* Header with back button and title */}
			<View style={styles.screenHeader}>
				<TouchableOpacity style={styles.headerBackButton} onPress={() => navigation.goBack()}>
					<Icon name="chevron-back" size={24} color={colors.text.primary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Privacy & Data</Text>
				<View style={styles.headerRightPlaceholder} />
			</View>

			<ScrollView style={styles.settingsList}>
				{/* Export Data Card */}
				<View style={styles.settingsCard}>
					<Text style={styles.cardTitleCenter}>Export Your Data</Text>
					<Text style={styles.cardDescription}>
						Download your data for backup or to use with other services.
					</Text>
					<View>
						{[
							{
								icon: 'download-outline',
								text: 'Export Complete Data',
								onPress: () => handleExport(false),
							},
							{
								icon: 'people-outline',
								text: 'Export Contact Info Only',
								onPress: () => handleExport(true),
							},
						].map((item, index, array) => (
							<TouchableOpacity
								key={item.text}
								style={[styles.settingItem, index === array.length - 1 && { borderBottomWidth: 0 }]}
								onPress={item.onPress}
							>
								<View style={styles.settingItemLeft}>
									<Icon name={item.icon} size={24} color={colors.primary} />
									<Text style={styles.settingText}>{item.text}</Text>
								</View>
							</TouchableOpacity>
						))}
					</View>
				</View>

				{/* Privacy Policy Card */}
				<View style={styles.settingsCard}>
					<Text style={styles.cardTitleCenter}>Privacy Policy</Text>
					<Text style={styles.cardDescription}>Review how we handle your data and your privacy rights.</Text>
					<View>
						{[
							{
								icon: 'shield-checkmark-outline',
								text: 'View Privacy Policy',
								onPress: () => Linking.openURL('https://onmylist.pro/privacy'),
								showExternalIcon: true,
							},
						].map((item, index, array) => (
							<TouchableOpacity
								key={item.text}
								style={[styles.settingItem, index === array.length - 1 && { borderBottomWidth: 0 }]}
								onPress={item.onPress}
							>
								<View style={styles.settingItemLeft}>
									<Icon name={item.icon} size={24} color={colors.primary} />
									<Text style={styles.settingText}>{item.text}</Text>
								</View>
								{item.showExternalIcon && <Icon name="open-outline" size={20} color={colors.primary} />}
							</TouchableOpacity>
						))}
					</View>
				</View>

				{/* Delete Account Card */}
				<View style={styles.dangerSettingsCard}>
					<Text style={styles.dangerCardTitle}>Danger Zone</Text>
					<Text style={styles.dangerCardDescription}>
						Permanently delete your account and all associated data. This action cannot be undone.
					</Text>

					<TouchableOpacity style={styles.dangerButton} onPress={handleDelete}>
						<Icon name="trash-outline" size={20} color={colors.background.primary} />
						<Text style={styles.dangerButtonText}>Delete Account</Text>
					</TouchableOpacity>
				</View>
			</ScrollView>
		</View>
	);
};

export default PrivacyScreen;
