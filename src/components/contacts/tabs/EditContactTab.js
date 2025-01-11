import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Image as ExpoImage } from 'expo-image';
import ImagePickerComponent from '../../general/ImagePicker';
import { useTheme } from '../../../context/ThemeContext';
import { useCommonStyles } from '../../../styles/common';
import { useStyles } from '../../../styles/screens/contacts';
import { updateContact, uploadContactPhoto, deleteContact, archiveContact } from '../../../utils/firestore';
import RelationshipPicker from '../../general/RelationshipPicker';
import { formatPhoneNumber } from '../../general/FormattedPhoneNumber';
import { DEFAULT_RELATIONSHIP_TYPE } from '../../../../constants/relationships';

const EditContactTab = ({ contact, setSelectedContact, loadContacts, onClose, cleanupSubscription }) => {
	const { colors } = useTheme();
	const commonStyles = useCommonStyles();
	const styles = useStyles();
	const [newTag, setNewTag] = useState('');
	const inputRef = useRef(null);
	const [isEditing, setIsEditing] = useState(false);
	const [formData, setFormData] = useState({
		...contact,
		scheduling: {
			...contact.scheduling,
			relationship_type: contact.scheduling?.relationship_type || DEFAULT_RELATIONSHIP_TYPE,
		},
	});

	const handleAddTag = async () => {
		if (!newTag.trim()) return;

		const normalizedNewTag = newTag.trim().toLowerCase();
		const existingTags = formData.tags || [];
		if (existingTags.some((tag) => tag.toLowerCase() === normalizedNewTag)) {
			Alert.alert('Duplicate Tag', 'This tag already exists.');
			setNewTag('');
			return;
		}

		const updatedTags = [...existingTags, newTag.trim()];

		try {
			// Update Firestore first
			await updateContact(contact.id, { tags: updatedTags });

			// Then update both local states
			const updatedContact = {
				...contact,
				tags: updatedTags,
			};
			setSelectedContact(updatedContact);
			setFormData((prev) => ({
				...prev,
				tags: updatedTags,
			}));
			setNewTag('');
			inputRef.current?.focus();
		} catch (error) {
			Alert.alert('Error', 'Failed to add tag');
			console.error('Error adding tag:', error);
		}
	};

	const handleDeleteTag = async (tagToDelete) => {
		const updatedTags = formData.tags.filter((tag) => tag !== tagToDelete);

		try {
			// Update Firestore first
			await updateContact(contact.id, { tags: updatedTags });

			// Then update both local states
			const updatedContact = {
				...contact,
				tags: updatedTags,
			};
			setSelectedContact(updatedContact);
			setFormData((prev) => ({
				...prev,
				tags: updatedTags,
			}));
		} catch (error) {
			Alert.alert('Error', 'Failed to delete tag');
			console.error('Error deleting tag:', error);
		}
	};

	const handleEditPhotoUpload = async () => {
		try {
			// ImagePickerComponent
			await ImagePickerComponent(async (croppedImagePath) => {
				// Upload cropped image
				const uploadedPhotoURL = await uploadContactPhoto(contact.user_id, croppedImagePath);

				// Update the contact with the uploaded photo URL
				const updatedContact = { ...contact, photo_url: uploadedPhotoURL };

				// Update local state immediately
				setFormData((prev) => ({
					...prev,
					photo_url: uploadedPhotoURL,
				}));
				setSelectedContact(updatedContact);

				// Update Firestore
				await updateContact(contact.id, updatedContact);
			});
		} catch (error) {
			console.error('Error uploading photo:', error);
			Alert.alert('Error', 'Failed to upload photo.');
		}
	};

	const handleSave = async () => {
		try {
			const updatedContact = {
				...contact,
				first_name: formData.first_name,
				last_name: formData.last_name,
				email: formData.email,
				phone: formData.phone,
				photo_url: formData.photo_url,
				scheduling: {
					...contact.scheduling,
					relationship_type: formData.scheduling.relationship_type,
					frequency: contact.scheduling?.frequency || 'weekly',
					custom_schedule: contact.scheduling?.custom_schedule || false,
					priority: contact.scheduling?.priority || 'normal',
					minimum_gap: contact.scheduling?.minimum_gap || 30,
					custom_preferences: {
						preferred_days: contact.scheduling?.custom_preferences?.preferred_days || [],
						active_hours: contact.scheduling?.custom_preferences?.active_hours || {
							start: '09:00',
							end: '17:00',
						},
						excluded_times: contact.scheduling?.custom_preferences?.excluded_times || [],
					},
				},
			};

			// Update local state immediately
			setSelectedContact(updatedContact);

			// Update Firestore
			await updateContact(contact.id, updatedContact);
			setIsEditing(false);
		} catch (error) {
			console.error('Error updating contact:', error);
			Alert.alert('Error', 'Failed to update contact');
			// Revert local state on error
			setSelectedContact(contact);
			setFormData(contact);
		}
	};

	return (
		<>
			<View style={{ flex: 1 }}>
				<ScrollView
					style={[styles.tabContent, { flex: 1 }]}
					contentContainerStyle={styles.scrollContent}
					scrollEnabled={true}
					showsVerticalScrollIndicator={false}
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
																	setFormData((prev) => ({
																		...prev,
																		photo_url: null,
																	}));
																	setSelectedContact({
																		...contact,
																		photo_url: null,
																	});
																	loadContacts();
																} catch (error) {
																	Alert.alert('Error', 'Failed to remove photo');
																}
															},
														},
													]);
												}}
											>
												<Icon name="close-circle" size={28} color="#FF6B6B" />
											</TouchableOpacity>
										)}
									</View>
								) : (
									<TouchableOpacity
										style={styles.uploadButton}
										onPress={isEditing ? handleEditPhotoUpload : null}
									>
										<Icon name="camera-outline" size={50} color={colors.primary} />
									</TouchableOpacity>
								)}
								{!isEditing && (
									<TouchableOpacity style={styles.editAvatarButton} onPress={() => setIsEditing(true)}>
										<Icon name="create-outline" size={20} color="#FFFFFF" />
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
										value={formatPhoneNumber(formData.phone)}
										onChangeText={(text) => {
											const cleaned = text.replace(/\D/g, '');
											setFormData({ ...formData, phone: cleaned });
										}}
										placeholder="Phone"
										placeholderTextColor={colors.text.secondary}
										keyboardType="phone-pad"
									/>

									<View style={{ marginTop: 1 }}>
										<View
											style={{
												backgroundColor:
													colors.theme === 'dark' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.05)',
												paddingHorizontal: 12,
												paddingTop: 8,
												paddingBottom: 0,
												marginBottom: 8,
											}}
										>
											<Text
												style={[
													styles.contactDetail,
													{
														color: colors.text.primary,
														fontWeight: '500',
													},
												]}
											>
												Relationship Type
											</Text>
										</View>
										<RelationshipPicker
											value={formData.scheduling?.relationship_type}
											onChange={(type) =>
												setFormData({
													...formData,
													scheduling: {
														...formData.scheduling,
														relationship_type: type,
													},
												})
											}
											showLabel={false}
										/>
									</View>

									<View style={styles.separator} />
									<View style={styles.dangerSection}>
										<TouchableOpacity
											style={styles.dangerButton}
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
											<Icon name="archive-outline" size={24} color={colors.text.secondary} />
											<Text style={styles.dangerButtonText}>Archive</Text>
										</TouchableOpacity>

										<TouchableOpacity
											style={styles.dangerButton}
											onPress={() => {
												Alert.alert('Delete Contact', 'Are you sure you want to delete this contact?', [
													{ text: 'Cancel', style: 'cancel' },
													{
														text: 'Delete',
														style: 'destructive',
														onPress: () => {
															Alert.alert(
																'Confirm Deletion',
																'All data and call history for this contact will be permanently deleted. This action cannot be undone.',
																[
																	{ text: 'Cancel', style: 'cancel' },
																	{
																		text: 'Delete Permanently',
																		style: 'destructive',
																		onPress: async () => {
																			try {
																				// Close the contact details
																				onClose();
																				// Delete the contact
																				await deleteContact(contact.id);
																				// Refresh the contacts list
																				await loadContacts();
																			} catch (error) {
																				console.error('Delete error:', error);
																				Alert.alert('Error', 'Unable to delete contact');
																			}
																		},
																	},
																]
															);
														},
													},
												]);
											}}
										>
											<Icon name="trash-outline" size={24} color={colors.danger} />
											<Text style={[styles.dangerButtonText, { color: colors.danger }]}>Delete</Text>
										</TouchableOpacity>
									</View>
								</View>
							) : (
								<View style={styles.viewFields}>
									<View style={styles.centeredDetails}>
										{formData.email && <Text style={styles.contactDetail}>{formData.email}</Text>}
										{formData.phone && (
											<Text style={styles.contactDetail}>{formatPhoneNumber(formData.phone)}</Text>
										)}
										{formData.scheduling?.relationship_type && (
											<Text style={styles.contactDetail}>
												Relationship:{' '}
												{formData.scheduling.relationship_type.charAt(0).toUpperCase() +
													formData.scheduling.relationship_type.slice(1)}
											</Text>
										)}
									</View>

									<View style={styles.separator} />

									<View style={styles.tagInputWrapper}>
										<TextInput
											ref={inputRef}
											style={[styles.tagInput, { textAlign: 'center' }]}
											placeholder="Add a Tag"
											placeholderTextColor={colors.text.secondary}
											value={newTag}
											onChangeText={setNewTag}
											onSubmitEditing={handleAddTag}
											returnKeyType="done"
											blurOnSubmit={false}
										/>
										<Text style={styles.tagInputHelper}>Tags help you remember what matters most.</Text>
									</View>
									<View style={styles.tagsContainer}>
										{(formData.tags || []).map((tag, index) => (
											<View key={index} style={styles.tagBubble}>
												<Text style={styles.tagText}>{tag}</Text>
												<TouchableOpacity
													onPress={() => {
														Alert.alert('Delete Tag', `Are you sure you want to delete "${tag}"?`, [
															{ text: 'Cancel', style: 'cancel' },
															{
																text: 'Delete',
																style: 'destructive',
																onPress: () => handleDeleteTag(tag),
															},
														]);
													}}
												>
													<Icon
														name="close-circle"
														size={16}
														color={colors.text.secondary}
														style={styles.tagDeleteIcon}
													/>
												</TouchableOpacity>
											</View>
										))}
									</View>
								</View>
							)}
						</View>
					</TouchableOpacity>
				</ScrollView>
			</View>
		</>
	);
};

export default EditContactTab;
