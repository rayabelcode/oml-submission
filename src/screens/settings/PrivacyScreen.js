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
	const { colors, spacing, layout } = useTheme();
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
							// Direct deletion for Apple users
							handleAccountDeletion();
						} else {
							// Password verification for email users
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

	// Function for account deletion
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

								// Continue with deletion
								await deleteUserAccount(user.uid);
								await user.delete();
								await cleanupSubscriptions();
								await signOut();
							} catch (error) {
								console.error('Error during verification:', error);
								Alert.alert('Error', 'Failed to verify identity. Please try again.');
							}
						},
					},
				]);
			} else {
				// Delete Firestore data
				await deleteUserAccount(user.uid);
				// Delete Firebase Auth account
				await user.delete();
				// Clean up and sign out
				await cleanupSubscriptions();
				await signOut();
			}
		} catch (error) {
			console.error('Error deleting account:', error);
			Alert.alert('Error', 'Failed to delete account. Please try signing out and back in, then try again.');
		}
	};

	return (
		<View style={styles.container}>
			{/* Header */}
			<View style={styles.headerSettingsPages}>
				<TouchableOpacity style={styles.settingItemLeft} onPress={() => navigation.goBack()}>
					<Icon name="chevron-back" size={24} color={colors.text.primary} />
					<Text style={[styles.profileName, { fontSize: 20 }]}>Data | Privacy</Text>
				</TouchableOpacity>
			</View>

			<ScrollView style={styles.settingsList}>
				{/* Export Data Section */}
				<View style={[styles.formSection, styles.card]}>
					<Text style={[styles.sectionTitle, { textAlign: 'center' }]}>Export Data</Text>
					<Text style={[styles.sectionDescription, { textAlign: 'center' }]}>
						Download your data for backup or transfer.
					</Text>

					<TouchableOpacity style={styles.settingItem} onPress={() => handleExport(false)}>
						<View style={styles.settingItemLeft}>
							<Icon name="download-outline" size={24} color={colors.text.primary} />
							<Text style={styles.settingText}>Export All Data</Text>
						</View>
					</TouchableOpacity>

					<TouchableOpacity style={styles.settingItem} onPress={() => handleExport(true)}>
						<View style={styles.settingItemLeft}>
							<Icon name="people-outline" size={24} color={colors.text.secondary} />
							<Text style={styles.settingText}>Export Contacts Only</Text>
						</View>
					</TouchableOpacity>
				</View>

				{/* Delete Account Section */}
				<View style={[styles.formSection, styles.card]}>
					<Text style={[styles.sectionTitle, { textAlign: 'center', color: colors.danger }]}>
						Delete Account
					</Text>
					<Text
						style={[
							styles.sectionDescription,
							{ textAlign: 'center', marginBottom: spacing.lg, color: colors.text.secondary },
						]}
					>
						Warning: This action is irreversible and will delete all your data.
					</Text>

					{/* Delete Account Button */}
					<View style={{ alignItems: 'center', marginVertical: spacing.md }}>
						<TouchableOpacity
							style={{
								backgroundColor: colors.danger,
								paddingVertical: spacing.sm,
								paddingHorizontal: spacing.md,
								borderRadius: layout.borderRadius.md,
								flexDirection: 'row',
								alignItems: 'center',
								justifyContent: 'center',
							}}
							onPress={handleDelete}
						>
							<Icon name="trash-outline" size={24} color={colors.background.primary} />
							<Text
								style={{
									color: colors.background.primary,
									fontSize: 18,
									fontWeight: '600',
									marginLeft: spacing.sm,
								}}
							>
								Delete Account
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</ScrollView>
		</View>
	);
};

export default PrivacyScreen;
