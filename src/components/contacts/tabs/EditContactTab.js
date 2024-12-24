import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme } from '../../../context/ThemeContext';
import { useCommonStyles } from '../../../styles/common';
import { useStyles } from '../../../styles/screens/contacts';
import AutoDismissModalContainer from '../../../components/general/AutoDismissModalContainer';
import { updateContact, uploadContactPhoto, deleteContact, archiveContact } from '../../../utils/firestore';

const EditContactTab = ({ contact, setSelectedContact, loadContacts, onClose }) => {
	const { colors } = useTheme();
	const commonStyles = useCommonStyles();
	const styles = useStyles();

	const [isEditing, setIsEditing] = useState(false);
	const [formData, setFormData] = useState({ ...contact });
	const [showSuccess, setShowSuccess] = useState(false);

	const handleEditPhotoUpload = async () => {
		try {
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

				await updateContact(contact.id, {
					...contact,
					photo_url: photoURL,
				});

				setFormData((prevFormData) => ({
					...prevFormData,
					photo_url: photoURL,
				}));

				setSelectedContact((prev) => ({
					...prev,
					photo_url: photoURL,
				}));

				await loadContacts();
			}
		} catch (error) {
			console.error('Error uploading photo:', error);
			Alert.alert('Error', 'Failed to upload photo');
		}
	};

	const handleSave = async () => {
		try {
			await updateContact(contact.id, {
				first_name: formData.first_name,
				last_name: formData.last_name,
				email: formData.email,
				phone: formData.phone,
				photo_url: formData.photo_url,
			});
			setSelectedContact(formData);
			setIsEditing(false);
			await loadContacts();
			setShowSuccess(true);
		} catch (error) {
			Alert.alert('Error', 'Failed to update contact');
		}
	};

	return (
		<View style={{ flex: 1 }}>
			<ScrollView
				style={[styles.tabContent, { flex: 1 }]}
				contentContainerStyle={{ paddingBottom: 20 }}
				scrollEnabled={true}
				showsVerticalScrollIndicator={true}
			>
				<TouchableOpacity activeOpacity={1}>
					<View style={styles.contactHeader}>
						<View style={styles.photoContainer}>
							{formData.photo_url ? (
								<View style={styles.photoPreview}>
									<ExpoImage
										source={{ uri: formData.photo_url }}
										style={styles.photoImage}
										cachePolicy="memory-disk"
									/>
									{isEditing && (
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
																setFormData((prev) => ({ ...prev, photo_url: null }));
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
									)}
								</View>
							) : (
								<TouchableOpacity style={styles.uploadButton} onPress={handleEditPhotoUpload}>
									<Icon name="camera-outline" size={24} color={colors.primary} />
									<Text style={styles.uploadButtonText}>Add Photo</Text>
								</TouchableOpacity>
							)}
						</View>

						<View style={styles.headerButtons}>
							{isEditing && (
								<>
									<TouchableOpacity style={[styles.headerButton, styles.saveButton]} onPress={handleSave}>
										<Text style={styles.saveButtonText}>Save</Text>
									</TouchableOpacity>
									<TouchableOpacity
										style={[styles.headerButton, styles.cancelButton]}
										onPress={() => {
											setFormData({ ...contact });
											setIsEditing(false);
										}}
									>
										<Text style={[styles.cancelButtonText, { color: colors.text.primary }]}>Cancel</Text>
									</TouchableOpacity>
								</>
							)}
						</View>
					</View>
				</TouchableOpacity>

				<TouchableOpacity activeOpacity={1}>
					<View style={styles.contactDetails}>
						{isEditing ? (
							<View style={styles.editFields}>
								<TextInput
									style={styles.editInput}
									value={formData.first_name}
									onChangeText={(text) => setFormData({ ...formData, first_name: text })}
									placeholder="First Name"
									placeholderTextColor={colors.text.secondary}
									autoCorrect={false}
									autoCapitalize="words"
								/>
								<TextInput
									style={styles.editInput}
									value={formData.last_name}
									onChangeText={(text) => setFormData({ ...formData, last_name: text })}
									placeholder="Last Name"
									placeholderTextColor={colors.text.secondary}
									autoCorrect={false}
									autoCapitalize="words"
								/>
								<TextInput
									style={styles.editInput}
									value={formData.email}
									onChangeText={(text) => setFormData({ ...formData, email: text })}
									placeholder="Email"
									placeholderTextColor={colors.text.secondary}
									keyboardType="email-address"
									autoCapitalize="none"
									autoCorrect={false}
								/>

								<TextInput
									style={styles.editInput}
									value={formData.phone}
									onChangeText={(text) => setFormData({ ...formData, phone: text })}
									placeholder="Phone"
									placeholderTextColor={colors.text.secondary}
									keyboardType="phone-pad"
								/>
							</View>
						) : (
							<View style={styles.viewFields}>
								<Text style={styles.fullName}>{`${formData.first_name} ${formData.last_name}`}</Text>
								{formData.email && <Text style={styles.contactDetail}>{formData.email}</Text>}
								{formData.phone && <Text style={styles.contactDetail}>{formData.phone}</Text>}
							</View>
						)}
					</View>
				</TouchableOpacity>

				{!isEditing && (
					<TouchableOpacity activeOpacity={1}>
						<View style={styles.separator} />
						<View style={styles.actionButtons}>
							<TouchableOpacity style={[styles.actionButton]} onPress={() => setIsEditing(true)}>
								<Icon name="create-outline" size={32} color={colors.primary} />
								<Text style={[styles.actionButtonText, { color: colors.primary }]}>Edit</Text>
							</TouchableOpacity>

							<TouchableOpacity
								style={[styles.actionButton]}
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
													Alert.alert('Error', 'Unable to archive contact');
												}
											},
										},
									]);
								}}
							>
								<Icon name="archive-outline" size={32} color={colors.text.secondary} />
								<Text style={[styles.actionButtonText, { color: colors.text.secondary }]}>Archive</Text>
							</TouchableOpacity>

							<TouchableOpacity
								style={[styles.actionButton]}
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
														Alert.alert('Error', 'Unable to delete contact');
													}
												},
											},
										]
									);
								}}
							>
								<Icon name="trash-outline" size={32} color={colors.danger} />
								<Text style={[styles.actionButtonText, { color: colors.danger }]}>Delete</Text>
							</TouchableOpacity>
						</View>
					</TouchableOpacity>
				)}
			</ScrollView>
			<AutoDismissModalContainer
				message="Contact Updated"
				isVisible={showSuccess}
				onDismiss={() => setShowSuccess(false)}
			/>
		</View>
	);
};

export default EditContactTab;
