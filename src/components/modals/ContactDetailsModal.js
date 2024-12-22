import React, { useState, useEffect } from 'react';
import {
	Modal,
	View,
	Text,
	TouchableOpacity,
	TextInput,
	ScrollView,
	Alert,
	KeyboardAvoidingView,
	Platform,
	Keyboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { Image as ExpoImage } from 'expo-image';
import { TabView } from 'react-native-tab-view';
import { useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme } from '../../context/ThemeContext';
import { useCommonStyles } from '../../styles/common';
import { useStyles } from '../../styles/screens/contacts';
import {
	updateContact,
	addContactHistory,
	fetchContactHistory,
	uploadContactPhoto,
	deleteContact,
	archiveContact,
} from '../../utils/firestore';
import { generateTopicSuggestions } from '../../utils/ai';
import TagsModal from './TagsModal';
import DatePickerModal from './DatePickerModal';

const ContactDetailsModal = ({ visible, contact, setSelectedContact, onClose, loadContacts }) => {
	const { colors } = useTheme();
	const commonStyles = useCommonStyles();
	const styles = useStyles();
	// Layout hooks
	const layout = useWindowDimensions();
	const { user } = useAuth();

	// Tab navigation state
	const [index, setIndex] = useState(0);
	const [routes] = useState([
		{ key: 'notes', icon: 'document-text-outline' },
		{ key: 'schedule', icon: 'calendar-outline' },
		{ key: 'tags', icon: 'pricetag-outline' },
		{ key: 'edit', icon: 'create-outline' },
	]);

	const [history, setHistory] = useState([]);
	const [editMode, setEditMode] = useState(null);
	const [callNotes, setCallNotes] = useState('');
	const [callDate, setCallDate] = useState(new Date());
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [showScheduleDatePicker, setShowScheduleDatePicker] = useState(false);
	const [suggestions, setSuggestions] = useState([]);
	const [loadingSuggestions, setLoadingSuggestions] = useState(false);
	const [suggestionCache, setSuggestionCache] = useState({});
	const [isTagsModalVisible, setIsTagsModalVisible] = useState(false);
	const [newTag, setNewTag] = useState('');
	const [selectedDate, setSelectedDate] = useState(
		contact?.next_contact ? new Date(contact.next_contact) : new Date()
	);
	const [formData, setFormData] = useState({ ...contact });

	const dismissKeyboard = () => {
		if (Platform.OS !== 'web') {
			Keyboard.dismiss();
		}
	};

	// Always set contact view to Call History tab
	useEffect(() => {
		if (visible) {
			setIndex(0);
		}
	}, [visible]);

	// Fetch Contact History
	useEffect(() => {
		if (contact?.id) {
			fetchContactHistory(contact?.id).then((history) => {
				const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
				setHistory(sortedHistory);
			});
			setFormData({ ...contact });
		}
	}, [contact]);

	// Load cached suggestions from storage
	useEffect(() => {
		const loadCache = async () => {
			try {
				const cached = await AsyncStorage.getItem('suggestionCache');
				if (cached) {
					setSuggestionCache(JSON.parse(cached));
				}
			} catch (error) {
				console.error('Error loading suggestion cache:', error);
			}
		};
		loadCache();
	}, []);

	// Fetch AI Topic Suggestions
	useEffect(() => {
		if (visible && contact?.id) {
			const cached = suggestionCache[contact.id];

			if (cached) {
				setSuggestions(cached.suggestions);
				return;
			}

			if (!contact.contact_history?.length) {
				setSuggestions(['AI suggestions will appear here after your first call.']);
				return;
			}

			setLoadingSuggestions(true);
			generateTopicSuggestions(contact, contact.contact_history)
				.then(async (topics) => {
					const newCache = {
						...suggestionCache,
						[contact.id]: {
							suggestions: topics,
							historyLength: contact.contact_history.length,
							timestamp: Date.now(),
						},
					};
					setSuggestionCache(newCache);
					setSuggestions(topics);

					try {
						await AsyncStorage.setItem('suggestionCache', JSON.stringify(newCache));
					} catch (error) {
						console.error('Error saving suggestion cache:', error);
					}
				})
				.catch((error) => {
					console.error('Error fetching topic suggestions:', error);
					setSuggestions(['Unable to generate suggestions at this time.']);
				})
				.finally(() => {
					setLoadingSuggestions(false);
				});
		}
	}, [visible, contact?.id, suggestionCache]);

	if (!contact) {
		return null;
	}

	// Render Tab Scene
	const renderScene = ({ route }) => {
		switch (route.key) {
			case 'notes':
				return (
					<ScrollView style={styles.tabContent}>
						{/* Call Notes Section */}
						<View style={styles.callNotesSection}>
							<TextInput
								style={styles.callNotesInput}
								multiline
								value={callNotes}
								onChangeText={setCallNotes}
								placeholder="Add a call here! What did you discuss?"
								placeholderTextColor={colors.text.secondary}
							/>
							<View style={styles.callNotesControls}>
								<TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
									<Text style={styles.dateButtonText}>
										{callDate.toDateString() === new Date().toDateString()
											? 'Today'
											: callDate.toLocaleDateString()}
									</Text>
								</TouchableOpacity>
								<TouchableOpacity
									style={styles.submitCallButton}
									onPress={() => handleAddCallNotes(callNotes, callDate)}
								>
									<Text style={commonStyles.primaryButtonText}>Submit</Text>
								</TouchableOpacity>
							</View>
						</View>

						<DatePickerModal
							visible={showDatePicker}
							onClose={() => setShowDatePicker(false)}
							selectedDate={callDate}
							onDateSelect={(event, date) => {
								if (Platform.OS === 'web') {
									const newDate = new Date(event);
									newDate.setHours(12, 0, 0, 0);
									setCallDate(newDate);
									setShowDatePicker(false);
								} else if (date && event.type === 'set') {
									const newDate = new Date(date);
									newDate.setHours(12, 0, 0, 0);
									setCallDate(newDate);
									setShowDatePicker(false);
								}
							}}
						/>

						{/* AI Suggestions */}
						{loadingSuggestions ? (
							<Text style={styles.suggestionsText}>Loading suggestions...</Text>
						) : (
							<View style={styles.suggestionsContainer}>
								<Text style={styles.suggestionsTitle}>Suggested Topics:</Text>
								{suggestions.map((topic, index) => (
									<Text key={index} style={styles.suggestion}>
										{topic}
									</Text>
								))}
							</View>
						)}

						{/* Contact History */}
						<View style={styles.historySection}>
							<Text style={styles.sectionTitle}>Contact History</Text>
							{history.length === 0 ? (
								<Text style={styles.emptyHistoryText}>
									Add your contact history above to view your call history...
								</Text>
							) : (
								history.map((entry, index) => (
									<View key={index} style={styles.historyEntry}>
										<Text style={styles.historyDate}>{new Date(entry.date).toLocaleDateString()}</Text>
										{editMode === index ? (
											<TextInput
												style={styles.historyNotesInput}
												value={entry.notes}
												onChangeText={(text) => {
													const updatedHistory = [...history];
													updatedHistory[index].notes = text;
													setHistory(updatedHistory);
												}}
											/>
										) : (
											<Text style={styles.historyNotes}>{entry.notes}</Text>
										)}
										<View style={styles.historyActions}>
											<TouchableOpacity
												style={styles.historyActionButton}
												onPress={() =>
													editMode === index ? handleEditHistory(index, entry.notes) : setEditMode(index)
												}
											>
												<Icon
													name={editMode === index ? 'checkmark-outline' : 'create-outline'}
													size={20}
													color={colors.primary}
												/>
											</TouchableOpacity>
											<TouchableOpacity
												style={styles.historyActionButton}
												onPress={() => handleDeleteHistory(index)}
											>
												<Icon name="trash-outline" size={20} color={colors.danger} />
											</TouchableOpacity>
										</View>
									</View>
								))
							)}
						</View>
					</ScrollView>
				);

			case 'schedule':
				return (
					<ScrollView style={styles.tabContent}>
						<View style={styles.scheduleContainer}>
							<Text style={styles.scheduleLabel}>Next Contact Date</Text>
							<Text style={styles.selectedDate}>
								{contact.next_contact ? new Date(contact.next_contact).toLocaleDateString() : 'Not Scheduled'}
							</Text>
						</View>

						<DatePickerModal
							visible={showScheduleDatePicker}
							onClose={() => setShowScheduleDatePicker(false)}
							selectedDate={selectedDate}
							onDateSelect={async (event, date) => {
								if (Platform.OS === 'web') {
									const newDate = new Date(event);
									newDate.setHours(12, 0, 0, 0);
									try {
										await updateContact(contact.id, {
											next_contact: newDate.toISOString(),
										});
										setSelectedContact({
											...contact,
											next_contact: newDate.toISOString(),
										});
										setSelectedDate(newDate);
										loadContacts();
										setShowScheduleDatePicker(false);
									} catch (error) {
										console.error('Error scheduling contact:', error);
										Alert.alert('Error', 'Failed to schedule contact');
									}
								} else if (date && event.type === 'set') {
									const newDate = new Date(date);
									newDate.setHours(12, 0, 0, 0);
									try {
										await updateContact(contact.id, {
											next_contact: newDate.toISOString(),
										});
										setSelectedContact({
											...contact,
											next_contact: newDate.toISOString(),
										});
										setSelectedDate(newDate);
										loadContacts();
										setShowScheduleDatePicker(false);
									} catch (error) {
										console.error('Error scheduling contact:', error);
										Alert.alert('Error', 'Failed to schedule contact');
									}
								}
							}}
						/>

						<View style={styles.scheduleActions}>
							<TouchableOpacity
								style={commonStyles.primaryButton}
								onPress={() => setShowScheduleDatePicker(true)}
							>
								<Text style={commonStyles.primaryButtonText}>Schedule Contact</Text>
							</TouchableOpacity>

							{contact.next_contact && (
								<TouchableOpacity
									style={styles.removeScheduleButton}
									onPress={async () => {
										try {
											await updateContact(contact.id, {
												next_contact: null,
											});
											setSelectedContact({
												...contact,
												next_contact: null,
											});
											setSelectedDate(new Date());
											loadContacts();
										} catch (error) {
											Alert.alert('Error', 'Failed to remove schedule');
										}
									}}
								>
									<Text style={styles.removeScheduleText}>Remove Schedule</Text>
								</TouchableOpacity>
							)}
						</View>
					</ScrollView>
				);

			case 'tags':
				return (
					<ScrollView style={styles.tabContent}>
						<View style={styles.tagsContainer}>
							{contact.tags?.map((tag, index) => (
								<View key={index} style={styles.tagBubble}>
									<Text style={styles.tagText}>{tag}</Text>
									<TouchableOpacity
										onPress={async () => {
											const updatedTags = contact.tags.filter((t) => t !== tag);
											await updateContact(contact.id, { tags: updatedTags });
											setSelectedContact({ ...contact, tags: updatedTags });
										}}
									>
										<Icon name="close-circle" size={20} color={colors.text.secondary} />
									</TouchableOpacity>
								</View>
							))}
						</View>
						<View style={styles.tagInputContainer}>
							<TextInput
								style={styles.tagInput}
								placeholder="Type new tag..."
								value={newTag}
								onChangeText={setNewTag}
								onSubmitEditing={() => {
									if (newTag.trim()) {
										const updatedTags = [...(contact.tags || []), newTag.trim()];
										updateContact(contact.id, { tags: updatedTags });
										setSelectedContact({ ...contact, tags: updatedTags });
										setNewTag('');
									}
								}}
							/>
							<TouchableOpacity
								style={styles.addTagButton}
								onPress={() => {
									if (newTag.trim()) {
										const updatedTags = [...(contact.tags || []), newTag.trim()];
										updateContact(contact.id, { tags: updatedTags });
										setSelectedContact({ ...contact, tags: updatedTags });
										setNewTag('');
									}
								}}
							>
								<Text style={commonStyles.primaryButtonText}>Add</Text>
							</TouchableOpacity>
						</View>
					</ScrollView>
				);

			case 'edit':
				const handleEditPhotoUpload = async () => {
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
						});

						if (!result.canceled && result.assets[0].uri) {
							const manipResult = await ImageManipulator.manipulateAsync(
								result.assets[0].uri,
								[{ resize: { width: 300, height: 300 } }],
								{ compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
							);

							const photoUrl = await uploadContactPhoto(user.uid, manipResult.uri);
							if (photoUrl) {
								await updateContact(contact.id, {
									...contact,
									photo_url: photoUrl,
								});
								setSelectedContact((prev) => ({ ...prev, photo_url: photoUrl }));
								loadContacts();
							} else {
								Alert.alert('Error', 'Failed to upload photo');
							}
						}
					} catch (error) {
						console.error('Error uploading photo:', error);
						Alert.alert('Error', 'Failed to upload photo');
					}
				};

				return (
					<ScrollView style={[styles.tabContent, styles.formScrollView]}>
						<View style={styles.photoUploadContainer}>
							{contact.photo_url ? (
								<View style={styles.photoPreview}>
									<ExpoImage
										source={{ uri: contact.photo_url }}
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
										'Are you sure you want to delete this contact? This deletes all call history and cannot be undone.',
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

			default:
				return null;
		}
	};

	const renderTabBar = (props) => (
		<View
			style={{
				flexDirection: 'row',
				backgroundColor: colors.background.primary,
				width: '100%',
				borderBottomWidth: 1,
				borderBottomColor: colors.border,
			}}
		>
			{props.navigationState.routes.map((route, index) => (
				<TouchableOpacity
					key={route.key}
					style={{
						flex: 1,
						minHeight: 50,
						alignItems: 'center',
						justifyContent: 'center',
						backgroundColor: props.navigationState.index === index ? '#e8f2ff' : colors.background.primary,
					}}
					onPress={() => {
						if (Platform.OS !== 'web') {
							Keyboard.dismiss();
						}
						setIndex(index);
					}}
				>
					<Icon
						name={route.icon}
						size={24}
						color={props.navigationState.index === index ? colors.primary : colors.text.secondary}
					/>
				</TouchableOpacity>
			))}
		</View>
	);

	const handleEditHistory = async (index, updatedNote) => {
		try {
			const updatedHistory = [...history];
			updatedHistory[index].notes = updatedNote;

			await updateContact(contact.id, { contact_history: updatedHistory });
			setHistory(updatedHistory);
			setEditMode(null);
		} catch (error) {
			console.error('Error editing history:', error);
			Alert.alert('Error', 'Failed to update contact history');
		}
	};

	const handleDeleteHistory = async (index) => {
		try {
			const updatedHistory = history.filter((_, i) => i !== index);

			await updateContact(contact.id, {
				contact_history: updatedHistory,
			});

			setHistory(updatedHistory);
			setSelectedContact({
				...contact,
				contact_history: updatedHistory,
			});

			setLoadingSuggestions(true);
			try {
				const topics = await generateTopicSuggestions(
					{ ...contact, contact_history: updatedHistory },
					updatedHistory
				);
				const newCache = {
					...suggestionCache,
					[contact.id]: {
						suggestions: topics,
						historyLength: updatedHistory.length,
						timestamp: Date.now(),
					},
				};
				setSuggestionCache(newCache);
				setSuggestions(topics);
				await AsyncStorage.setItem('suggestionCache', JSON.stringify(newCache));
			} catch (error) {
				console.error('Error updating suggestions:', error);
				setSuggestions(['Unable to generate suggestions at this time.']);
			} finally {
				setLoadingSuggestions(false);
			}
		} catch (error) {
			console.error('Error deleting history:', error);
			Alert.alert('Error', 'Failed to delete history entry');
		}
	};

	const handleAddCallNotes = async (notes, date) => {
		if (!notes.trim()) {
			Alert.alert('Error', 'Please enter the call notes');
			return;
		}

		try {
			const localDate = new Date(date);
			localDate.setHours(12, 0, 0, 0);

			const dateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(
				2,
				'0'
			)}-${String(localDate.getDate()).padStart(2, '0')}`;

			await addContactHistory(contact.id, {
				notes,
				date: dateStr,
			});

			const updatedHistory = await fetchContactHistory(contact.id);
			const sortedHistory = [...updatedHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
			setHistory(sortedHistory);

			const updatedContact = {
				...contact,
				contact_history: sortedHistory,
			};
			setSelectedContact(updatedContact);

			setLoadingSuggestions(true);
			try {
				const topics = await generateTopicSuggestions(updatedContact, sortedHistory);
				const newCache = {
					...suggestionCache,
					[contact.id]: {
						suggestions: topics,
						historyLength: sortedHistory.length,
						timestamp: Date.now(),
					},
				};
				setSuggestionCache(newCache);
				setSuggestions(topics);
				await AsyncStorage.setItem('suggestionCache', JSON.stringify(newCache));
			} catch (error) {
				console.error('Error updating suggestions:', error);
				setSuggestions(['Unable to generate suggestions at this time.']);
			} finally {
				setLoadingSuggestions(false);
			}

			setCallNotes('');
			setCallDate(new Date());
		} catch (error) {
			console.error('Error adding call notes:', error);
			Alert.alert('Error', 'Failed to add call notes');
		}
	};

	return (
		<Modal visible={visible} animationType="fade" transparent={true}>
			<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
				<View style={commonStyles.modalContainer}>
					<View style={commonStyles.modalContent}>
						<View style={commonStyles.modalHeader}>
							<TouchableOpacity style={styles.closeButton} onPress={onClose}>
								<Icon name="close-outline" size={24} color={colors.text.secondary} />
							</TouchableOpacity>
							<Text style={commonStyles.modalTitle}>
								{contact.first_name} {contact.last_name}
							</Text>
						</View>
						<TabView
							navigationState={{ index, routes }}
							renderScene={renderScene}
							renderTabBar={renderTabBar}
							onIndexChange={setIndex}
							initialLayout={{ width: layout.width, height: layout.height }}
							style={{ flex: 1, width: '100%' }}
						/>
						<TagsModal
							visible={isTagsModalVisible}
							onClose={() => setIsTagsModalVisible(false)}
							tags={contact.tags || []}
							onAddTag={async (tag) => {
								const updatedTags = [...(contact.tags || []), tag];
								await updateContact(contact.id, { tags: updatedTags });
								setSelectedContact({ ...contact, tags: updatedTags });
							}}
							onDeleteTag={async (tagToDelete) => {
								const updatedTags = (contact.tags || []).filter((tag) => tag !== tagToDelete);
								await updateContact(contact.id, { tags: updatedTags });
								setSelectedContact({ ...contact, tags: updatedTags });
							}}
						/>
					</View>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
};

export default ContactDetailsModal;
