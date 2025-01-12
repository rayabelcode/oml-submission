import React, { useState, useEffect, useRef } from 'react';
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
import ImagePickerComponent from '../general/ImagePicker';
import { Image as ExpoImage } from 'expo-image';
import { useStyles } from '../../styles/screens/contacts';
import { useCommonStyles } from '../../styles/common';
import { useTheme, spacing } from '../../context/ThemeContext';
import { uploadContactPhoto } from '../../utils/firestore';
import { useAuth } from '../../context/AuthContext';
import RelationshipPicker from '../general/RelationshipPicker';
import { createContactData, SCHEDULING_CONSTANTS } from '../../utils/contactHelpers';
import { DEFAULT_RELATIONSHIP_TYPE } from '../../../constants/relationships';
import { formatPhoneNumber } from '../general/FormattedPhoneNumber';

const ContactForm = ({ visible, onClose, onSubmit, loadContacts }) => {
	const { user } = useAuth();
	const { colors } = useTheme();
	const styles = useStyles();
	const commonStyles = useCommonStyles();

	const lastNameRef = useRef();
	const phoneRef = useRef();
	const emailRef = useRef();

	const [formData, setFormData] = useState({
		first_name: '',
		last_name: '',
		email: '',
		phone: '',
		photo_url: null,
		relationship_type: DEFAULT_RELATIONSHIP_TYPE,
	});

	const dismissKeyboard = () => {
		Keyboard.dismiss();
	};

	const handlePhotoUpload = async () => {
		try {
			await ImagePickerComponent(async (croppedImagePath) => {
				const photoUrl = await uploadContactPhoto(user.uid, croppedImagePath);
				if (photoUrl) {
					setFormData((prev) => ({ ...prev, photo_url: photoUrl }));
				} else {
					Alert.alert('Error', 'Failed to upload photo.');
				}
			});
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
				photo_url: null,
				relationship_type: DEFAULT_RELATIONSHIP_TYPE,
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
						<View
							style={[
								commonStyles.modalHeader,
								{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
							]}
						>
							<Icon
								name="person-add-outline"
								size={24}
								color={colors.text.primary}
								style={{ marginRight: spacing.sm }}
							/>
							<Text style={commonStyles.modalTitle}>Add New Contact</Text>
						</View>

						<ScrollView
							style={styles.formContainer}
							contentContainerStyle={{
								paddingBottom: spacing.sm,
								flexGrow: 1,
							}}
							keyboardShouldPersistTaps="handled"
						>
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
									<TouchableOpacity
										style={[styles.uploadButton, { marginBottom: 0 }]}
										onPress={handlePhotoUpload}
									>
										<Icon name="camera-outline" size={24} color={colors.primary} />
										<Text style={styles.uploadButtonText}>Add Photo</Text>
									</TouchableOpacity>
								)}
							</View>

							<RelationshipPicker
								value={formData.relationship_type}
								onChange={(type) => setFormData((prev) => ({ ...prev, relationship_type: type }))}
							/>

							<TextInput
								style={[commonStyles.input, { marginBottom: spacing.sm }]}
								placeholder="First Name"
								placeholderTextColor={colors.text.secondary}
								value={formData.first_name}
								onChangeText={(text) => setFormData({ ...formData, first_name: text })}
								autoCorrect={false}
								autoCapitalize="words"
								returnKeyType="next"
								onSubmitEditing={() => lastNameRef.current?.focus()}
								blurOnSubmit={false}
							/>

							<TextInput
								ref={lastNameRef}
								style={[commonStyles.input, { marginBottom: spacing.sm }]}
								placeholder="Last Name"
								placeholderTextColor={colors.text.secondary}
								value={formData.last_name}
								onChangeText={(text) => setFormData({ ...formData, last_name: text })}
								autoCorrect={false}
								autoCapitalize="words"
								returnKeyType="next"
								onSubmitEditing={() => phoneRef.current?.focus()}
								blurOnSubmit={false}
							/>

							<TextInput
								ref={phoneRef}
								style={[commonStyles.input, { marginBottom: spacing.sm }]}
								placeholder="Phone"
								placeholderTextColor={colors.text.secondary}
								value={formatPhoneNumber(formData.phone)}
								onChangeText={(text) => {
									const cleaned = text.replace(/\D/g, '');
									setFormData({ ...formData, phone: cleaned });
								}}
								keyboardType="phone-pad"
								returnKeyType="next"
								onSubmitEditing={() => emailRef.current?.focus()}
								blurOnSubmit={false}
							/>

							<TextInput
								ref={emailRef}
								style={commonStyles.input}
								placeholder="Email"
								placeholderTextColor={colors.text.secondary}
								value={formData.email}
								onChangeText={(text) => setFormData({ ...formData, email: text })}
								keyboardType="email-address"
								autoCapitalize="none"
								autoCorrect={false}
								returnKeyType="done"
								onSubmitEditing={dismissKeyboard}
							/>
						</ScrollView>

						<View style={[styles.editModalActions, { justifyContent: 'center', gap: spacing.md }]}>
							<TouchableOpacity
								style={[commonStyles.primaryButton, styles.saveButton]}
								onPress={() => {
									if (!formData.first_name.trim()) {
										Alert.alert('Error', 'First name is required');
										return;
									}
									const contactData = createContactData(formData, user.uid);
									onSubmit(contactData);
								}}
							>
								<Icon name="checkmark-outline" size={24} color="#FFFFFF" />
								<Text style={[commonStyles.primaryButtonText, { color: '#FFFFFF' }]}>Save</Text>
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
