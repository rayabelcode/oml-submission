import React, { useState, useEffect } from 'react';
import {
	Modal,
	View,
	Text,
	Keyboard,
	TouchableOpacity,
	TextInput,
	ScrollView,
	Alert,
	KeyboardAvoidingView,
	Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image as ExpoImage } from 'expo-image';
import { colors } from '../../styles/theme';
import commonStyles from '../../styles/common';
import styles from '../../styles/screens/contacts';
import { uploadContactPhoto } from '../../utils/firestore';
import { useAuth } from '../../context/AuthContext';

const ContactForm = ({ visible, onClose, onSubmit, loadContacts }) => {
	const { user } = useAuth();

	const [formData, setFormData] = useState({
		first_name: '',
		last_name: '',
		email: '',
		phone: '',
		frequency: 'weekly',
		photo_url: null,
	});

	const dismissKeyboard = () => {
		Keyboard.dismiss();
	};

	const handlePhotoUpload = async () => {
		try {
			const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
			if (status !== 'granted') {
				Alert.alert('Permission needed', 'Please grant permission to access your photos');
				return;
			}

			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ImagePicker.MediaTypeOptions.Images,
				allowsEditing: true,
				aspect: [1, 1],
				quality: 0.5,
				selectionLimit: 1,
			});

			if (!result.canceled && result.assets && result.assets[0]) {
				try {
					const manipResult = await ImageManipulator.manipulateAsync(
						result.assets[0].uri,
						[{ resize: { width: 300, height: 300 } }],
						{ compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
					);

					const photoUrl = await uploadContactPhoto(user.uid, manipResult.uri);
					if (photoUrl) {
						setFormData((prev) => ({ ...prev, photo_url: photoUrl }));
					} else {
						Alert.alert('Error', 'Failed to upload photo');
					}
				} catch (manipError) {
					console.error('Error manipulating image:', manipError);
					Alert.alert('Error', 'Failed to process the selected image');
				}
			}
		} catch (error) {
			console.error('Error uploading photo:', error);
			Alert.alert('Error', 'Failed to upload photo. Please try again.');
		}
	};

	useEffect(() => {
		if (!visible) {
			setFormData({
				first_name: '',
				last_name: '',
				email: '',
				phone: '',
				frequency: 'weekly',
				photo_url: null,
			});
		}
	}, [visible]);

	return (
		<Modal visible={visible} animationType="fade" transparent={true}>
			<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
				<TouchableOpacity style={commonStyles.modalContainer} activeOpacity={1} onPress={dismissKeyboard}>
					<TouchableOpacity
						activeOpacity={1}
						style={commonStyles.modalContent}
						onPress={(e) => e.stopPropagation()}
					>
						<View style={commonStyles.modalHeader}>
							<Text style={commonStyles.modalTitle}>Add New Contact</Text>
						</View>

						<ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
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
														onPress: () => setFormData({ ...formData, photo_url: null }),
													},
												]);
											}}
										>
											<Icon name="close-circle" size={24} color={colors.danger} />
										</TouchableOpacity>
									</View>
								) : (
									<TouchableOpacity style={styles.uploadButton} onPress={handlePhotoUpload}>
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
						</ScrollView>

						<View style={styles.editModalActions}>
							<TouchableOpacity
								style={[commonStyles.primaryButton, styles.saveButton]}
								onPress={() => {
									if (!formData.first_name.trim()) {
										Alert.alert('Error', 'First name is required');
										return;
									}
									onSubmit(formData);
								}}
							>
								<Icon name="checkmark-outline" size={24} color={colors.background.primary} />
								<Text style={commonStyles.primaryButtonText}>Save</Text>
							</TouchableOpacity>

							<TouchableOpacity style={[commonStyles.secondaryButton, styles.cancelButton]} onPress={onClose}>
								<Icon name="close-outline" size={24} color={colors.danger} />
								<Text style={[commonStyles.secondaryButtonText, { color: colors.danger }]}>Cancel</Text>
							</TouchableOpacity>
						</View>
					</TouchableOpacity>
				</TouchableOpacity>
			</KeyboardAvoidingView>
		</Modal>
	);
};

export default ContactForm;
