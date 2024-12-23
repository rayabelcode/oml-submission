import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme } from '../../../context/ThemeContext';
import { useCommonStyles } from '../../../styles/common';
import { useStyles } from '../../../styles/screens/contacts';
import { updateContact, uploadContactPhoto, deleteContact, archiveContact } from '../../../utils/firestore';

const EditContactTab = ({ contact, setSelectedContact, loadContacts, onClose }) => {
	const { colors } = useTheme();
	const commonStyles = useCommonStyles();
	const styles = useStyles();

	const [formData, setFormData] = useState({ ...contact });

	const handleEditPhotoUpload = async () => {
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (status !== 'granted') {
			Alert.alert('Permission Denied', 'Permission to access media library is required!');
			return;
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsEditing: true,
			aspect: [1, 1],
			quality: 1,
		});

		if (!result.canceled) {
			const manipResult = await ImageManipulator.manipulateAsync(
				result.assets[0].uri,
				[{ resize: { width: 500 } }],
				{ compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
			);
			const photoURL = await uploadContactPhoto(contact.id, manipResult.uri);
			setFormData((prevFormData) => ({
				...prevFormData,
				photo_url: photoURL,
			}));
		}
	};

	return (
		<ScrollView style={[styles.tabContent, styles.formScrollView]}>
			<View style={styles.photoUploadContainer}>
				{formData.photo_url ? (
					<View style={styles.photoPreview}>
						<ExpoImage
							source={{ uri: formData.photo_url }}
							style={styles.photoImage}
							cachePolicy="memory-disk"
						/>
						<TouchableOpacity
							style={styles.removePhotoButton}
							onPress={() => {
								Alert.alert('Remove Photo', 'Are you sure you want to remove this photo?', [
									{ text: 'Cancel', style: 'cancel' },
									{
										text: 'Remove',
										style: 'destructive',
										onPress: async () => {
											try {
												await updateContact(contact.id, {
													...contact,
													photo_url: null,
												});
												setSelectedContact({ ...contact, photo_url: null });
												loadContacts();
											} catch (error) {
												Alert.alert('Error', 'Failed to remove photo');
											}
										},
									},
								]);
							}}
						>
							<Icon name="close-circle" size={24} color={colors.danger} />
						</TouchableOpacity>
					</View>
				) : (
					<TouchableOpacity style={styles.uploadButton} onPress={handleEditPhotoUpload}>
						<Icon name="camera-outline" size={24} color={colors.primary} />
						<Text style={styles.uploadButtonText}>Add Photo</Text>
					</TouchableOpacity>
				)}
			</View>

			<TextInput
				style={commonStyles.input}
				placeholder="First Name"
				placeholderTextColor={colors.text.secondary}
				value={formData.first_name}
				onChangeText={(text) => setFormData({ ...formData, first_name: text })}
			/>

			<TextInput
				style={commonStyles.input}
				placeholder="Last Name"
				placeholderTextColor={colors.text.secondary}
				value={formData.last_name}
				onChangeText={(text) => setFormData({ ...formData, last_name: text })}
			/>

			<TextInput
				style={commonStyles.input}
				placeholder="Email"
				placeholderTextColor={colors.text.secondary}
				value={formData.email}
				onChangeText={(text) => setFormData({ ...formData, email: text })}
				keyboardType="email-address"
				autoCapitalize="none"
			/>

			<TextInput
				style={commonStyles.input}
				placeholder="Phone"
				placeholderTextColor={colors.text.secondary}
				value={formData.phone}
				onChangeText={(text) => setFormData({ ...formData, phone: text })}
				keyboardType="phone-pad"
			/>

			<View style={styles.editModalActions}>
				<TouchableOpacity
					style={styles.editActionButton}
					onPress={async () => {
						try {
							await updateContact(contact.id, {
								first_name: formData.first_name,
								last_name: formData.last_name,
								email: formData.email,
								phone: formData.phone,
								photo_url: formData.photo_url,
							});
							setSelectedContact(formData);
							Alert.alert('Success', 'Contact Updated');
							await loadContacts();
						} catch (error) {
							Alert.alert('Error', 'Failed to update contact');
						}
					}}
				>
					<Icon name="save-outline" size={24} color={colors.secondary} />
					<Text style={[styles.editActionText, { color: colors.secondary }]}>Save</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={styles.editActionButton}
					onPress={() => {
						Alert.alert('Archive Contact', 'Archive this contact?', [
							{ text: 'Cancel', style: 'cancel' },
							{
								text: 'Archive',
								onPress: async () => {
									try {
										await archiveContact(contact.id);
										await loadContacts();
										onClose();
									} catch (error) {
										console.error('Archive error:', error);
										Alert.alert('Error', 'Unable to archive contact');
									}
								},
							},
						]);
					}}
				>
					<Icon name="archive-outline" size={24} color={colors.primary} />
					<Text style={[styles.editActionText, { color: colors.primary }]}>Archive</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={styles.editActionButton}
					onPress={() => {
						Alert.alert(
							'Delete Contact',
							'Are you sure you want to delete this contact? This action cannot be undone.',
							[
								{ text: 'Cancel', style: 'cancel' },
								{
									text: 'Delete',
									style: 'destructive',
									onPress: async () => {
										try {
											await deleteContact(contact.id);
											await loadContacts();
											onClose();
										} catch (error) {
											console.error('Delete error:', error);
											Alert.alert('Error', 'Unable to delete contact');
										}
									},
								},
							]
						);
					}}
				>
					<Icon name="trash-outline" size={24} color={colors.danger} />
					<Text style={[styles.editActionText, { color: colors.danger }]}>Delete</Text>
				</TouchableOpacity>
			</View>
		</ScrollView>
	);
};

export default EditContactTab;
