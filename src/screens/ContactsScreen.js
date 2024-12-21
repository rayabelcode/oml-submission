import React, { useState, useEffect, useRef } from 'react';
import { Modal, Image, Dimensions } from 'react-native';
import DatePicker from 'react-datepicker';
import { SafeAreaView } from 'react-native';
import '../../assets/css/react-datepicker.css';
import { Text, View, ScrollView, TouchableOpacity, TextInput, RefreshControl, Alert } from 'react-native';
import styles from '../styles/screens/contacts';
import commonStyles from '../styles/common';
import { colors } from '../styles/theme';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import {
	fetchContacts,
	archiveContact,
	deleteContact,
	addContact,
	updateContact,
	addContactHistory,
	fetchContactHistory,
	uploadContactPhoto,
} from '../utils/firestore';
import Logo from '../../assets/full-logo-color.png';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';
import { generateTopicSuggestions } from '../utils/ai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image as ExpoImage } from 'expo-image';
import { serverTimestamp } from 'firebase/firestore';
import { TabView } from 'react-native-tab-view';
import { useWindowDimensions } from 'react-native';
import { KeyboardAvoidingView } from 'react-native';
import { Keyboard } from 'react-native';

// Shared DatePicker Modal Component
const DatePickerModal = ({ visible, onClose, selectedDate, onDateSelect, containerStyle }) => {
	return (
		<Modal visible={visible} transparent={true} animationType="fade">
			<TouchableOpacity style={commonStyles.modalContainer} onPress={onClose} activeOpacity={1}>
				<View style={[commonStyles.modalContent, containerStyle]} onClick={(e) => e.stopPropagation()}>
					{Platform.OS === 'web' ? (
						<DatePicker
							selected={selectedDate}
							onChange={onDateSelect}
							inline
							dateFormat="MM/dd/yyyy"
							renderCustomHeader={({
								date,
								decreaseMonth,
								increaseMonth,
								prevMonthButtonDisabled,
								nextMonthButtonDisabled,
							}) => (
								<div
									style={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center',
										padding: '10px',
									}}
								>
									<button
										onClick={decreaseMonth}
										disabled={prevMonthButtonDisabled}
										style={{
											border: 'none',
											background: 'none',
											cursor: 'pointer',
										}}
									>
										<Icon
											name="chevron-back-outline"
											size={24}
											color={prevMonthButtonDisabled ? '#ccc' : colors.primary}
										/>
									</button>
									<span style={{ fontWeight: '500', fontSize: '16px' }}>
										{date.toLocaleString('default', { month: 'long', year: 'numeric' })}
									</span>
									<button
										onClick={increaseMonth}
										disabled={nextMonthButtonDisabled}
										style={{
											border: 'none',
											background: 'none',
											cursor: 'pointer',
										}}
									>
										<Icon
											name="chevron-forward-outline"
											size={24}
											color={nextMonthButtonDisabled ? '#ccc' : colors.primary}
										/>
									</button>
								</div>
							)}
						/>
					) : (
						<DateTimePicker
							value={selectedDate}
							mode="date"
							display="inline"
							onChange={onDateSelect}
							textColor={colors.text.primary}
							accentColor={colors.primary}
							themeVariant="light"
						/>
					)}
				</View>
			</TouchableOpacity>
		</Modal>
	);
};

// Screen width for grid calculation
const windowWidth = Dimensions.get('window').width;

// Get initials for image avatar
const getInitials = (firstName, lastName) => {
	const firstInitial = firstName ? firstName[0] : '';
	const lastInitial = lastName ? lastName[0] : '';
	return (firstInitial + lastInitial).toUpperCase();
};

// Schedule Modal Component
const ScheduleModal = ({ visible, contact, onClose, onSubmit, setIsDetailsVisible, loadContacts }) => {
	const [selectedDate, setSelectedDate] = useState(new Date());
	const [showPicker, setShowPicker] = useState(false);

	const handleConfirm = () => {
		onSubmit(selectedDate);
	};

	return (
		<Modal visible={visible} animationType="fade" transparent={true}>
			<View style={commonStyles.modalContainer}>
				<View style={commonStyles.modalContent}>
					<View style={commonStyles.modalHeader}>
						<Text style={commonStyles.modalTitle}>Schedule Contact</Text>
						<TouchableOpacity onPress={onClose}>
							<Icon name="close-outline" size={24} color={colors.text.secondary} />
						</TouchableOpacity>
					</View>

					<View style={styles.scheduleContainer}>
						<Text style={styles.scheduleLabel}>Next Contact Date</Text>
						<Text style={styles.selectedDate}>{selectedDate.toLocaleDateString()}</Text>
					</View>

					{Platform.OS === 'web' ? (
						<DatePicker
							selected={selectedDate}
							onChange={(date) => {
								const newDate = new Date(date);
								newDate.setHours(12, 0, 0, 0);
								setSelectedDate(newDate);
								setShowPicker(false);
							}}
							inline
							dateFormat="MM/dd/yyyy"
						/>
					) : (
						<DateTimePicker
							value={selectedDate}
							mode="date"
							display="inline"
							onChange={(event, date) => {
								if (date) {
									const newDate = new Date(date);
									newDate.setHours(12, 0, 0, 0);
									setSelectedDate(newDate);
								}
							}}
							textColor={colors.text.primary}
							accentColor={colors.primary}
							themeVariant="light"
						/>
					)}

					<TouchableOpacity style={commonStyles.primaryButton} onPress={handleConfirm}>
						<Text style={commonStyles.primaryButtonText}>Confirm</Text>
					</TouchableOpacity>

					<TouchableOpacity
						style={styles.removeScheduleButton}
						onPress={() => {
							Alert.alert('Remove Schedule', 'Are you sure you want to remove the next scheduled contact?', [
								{ text: 'Cancel', style: 'cancel' },
								{
									text: 'Remove',
									onPress: async () => {
										try {
											await updateContact(contact.id, {
												next_contact: null,
											});
											await loadContacts();
											onClose();
											setIsDetailsVisible(true);
										} catch (error) {
											Alert.alert('Error', 'Failed to remove schedule');
										}
									},
								},
							]);
						}}
					>
						<Text style={styles.removeScheduleText}>Remove Next Call</Text>
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	);
};

// Contact Card Component
const ContactCard = ({ contact, onPress, loadContacts }) => {
	const [showActions, setShowActions] = useState(false);

	return (
		<TouchableOpacity
			style={styles.card}
			onPress={() => onPress(contact)}
			onLongPress={() => setShowActions(true)}
			delayLongPress={500}
		>
			<View style={styles.cardAvatar}>
				{contact.photo_url ? (
					Platform.OS === 'web' ? (
						contact.photo_url.startsWith('file://') ? (
							<Text style={styles.avatarText}>{getInitials(contact.first_name, contact.last_name)}</Text>
						) : (
							<ExpoImage
								source={{ uri: contact.photo_url }}
								style={styles.avatarImage}
								cachePolicy="memory-disk"
								transition={200}
							/>
						)
					) : (
						<ExpoImage
							source={{ uri: contact.photo_url }}
							style={styles.avatarImage}
							cachePolicy="memory-disk"
							transition={200}
						/>
					)
				) : (
					<Text style={styles.avatarText}>{getInitials(contact.first_name, contact.last_name)}</Text>
				)}
			</View>

			<View style={styles.nameContainer}>
				<Text style={styles.firstName} numberOfLines={1}>
					{contact.first_name}
				</Text>
				<Text style={styles.lastName} numberOfLines={1}>
					{contact.last_name || ''}
				</Text>
			</View>
			{contact.next_contact && (
				<View style={styles.scheduleBadge}>
					<View style={styles.scheduleDot} />
				</View>
			)}

			{showActions && (
				<View style={styles.actionsContainer}>
					<TouchableOpacity style={styles.closeButton} onPress={() => setShowActions(false)}>
						<Icon name="close" size={24} color={colors.text.primary} />
					</TouchableOpacity>

					<View style={styles.cardActions}>
						<View style={styles.actionButtonsContainer}>
							<TouchableOpacity
								style={styles.cardActionButton}
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
														setShowActions(false);
														await loadContacts();
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
								<Icon name="trash-outline" size={32} color="rgba(255, 0, 0, 0.8)" />
							</TouchableOpacity>

							<TouchableOpacity
								style={styles.cardActionButton}
								onPress={() => {
									Alert.alert('Archive Contact', 'Archive this contact?', [
										{ text: 'Cancel', style: 'cancel' },
										{
											text: 'Archive',
											onPress: async () => {
												try {
													await archiveContact(contact.id);
													setShowActions(false);
													await loadContacts();
												} catch (error) {
													console.error('Archive error:', error);
													Alert.alert('Error', 'Unable to archive contact');
												}
											},
										},
									]);
								}}
							>
								<Icon name="archive" size={32} color={colors.primary} />
							</TouchableOpacity>
						</View>
					</View>
				</View>
			)}
		</TouchableOpacity>
	);
};

const TagsModal = ({ visible, onClose, tags, onAddTag, onDeleteTag }) => {
	const [newTag, setNewTag] = useState('');

	const handleAddTag = () => {
		if (newTag.trim()) {
			onAddTag(newTag.trim());
			setNewTag('');
		}
	};

	return (
		<Modal visible={visible} animationType="fade" transparent={true}>
			<View style={commonStyles.modalContainer}>
				<View style={commonStyles.modalContent}>
					<View style={commonStyles.modalHeader}>
						<Text style={commonStyles.modalTitle}>Current Tags</Text>
						<TouchableOpacity onPress={onClose}>
							<Icon name="close-outline" size={24} color={colors.text.secondary} />
						</TouchableOpacity>
					</View>

					<View style={styles.tagsSection}>
						<View style={styles.tagsContainer}>
							{tags?.map((tag, index) => (
								<View key={index} style={styles.tagBubble}>
									<Text style={styles.tagText}>{tag}</Text>
									<TouchableOpacity onPress={() => onDeleteTag(tag)}>
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
								onSubmitEditing={handleAddTag}
							/>
							<TouchableOpacity style={styles.addTagButton} onPress={handleAddTag}>
								<Text style={commonStyles.primaryButtonText}>Add</Text>
							</TouchableOpacity>
						</View>

						<TouchableOpacity style={styles.doneButton} onPress={onClose}>
							<Text style={commonStyles.primaryButtonText}>Done</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</Modal>
	);
};

const ContactSearchModal = ({ visible, onClose, contacts, onSelectContact }) => {
	const [searchText, setSearchText] = useState('');
	const [filteredContacts, setFilteredContacts] = useState([]);

	useEffect(() => {
		if (searchText) {
			const filtered = contacts.filter((contact) => {
				const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
				return fullName.includes(searchText.toLowerCase());
			});
			setFilteredContacts(filtered);
		} else {
			setFilteredContacts([]);
		}
	}, [searchText, contacts]);

	return (
		<Modal visible={visible} animationType="fade" transparent={true}>
			<View style={commonStyles.modalContainer}>
				<View style={commonStyles.modalContent}>
					<View style={commonStyles.modalHeader}>
						<Text style={commonStyles.modalTitle}>Search Contacts</Text>
						<TouchableOpacity onPress={onClose}>
							<Icon name="close-outline" size={24} color={colors.text.secondary} />
						</TouchableOpacity>
					</View>

					<TextInput
						style={commonStyles.input}
						placeholder="Search by name..."
						value={searchText}
						onChangeText={setSearchText}
						autoFocus={true}
					/>

					<ScrollView style={styles.searchResults}>
						{filteredContacts.map((contact, index) => (
							<TouchableOpacity
								key={index}
								style={styles.searchResultItem}
								onPress={() => onSelectContact(contact)}
							>
								<Text style={styles.searchResultText}>
									{`${contact.firstName || ''} ${contact.lastName || ''}`.trim()}
								</Text>
							</TouchableOpacity>
						))}
					</ScrollView>
				</View>
			</View>
		</Modal>
	);
};

const ContactDetailsModal = ({ visible, contact, setSelectedContact, onClose, loadContacts }) => {
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
		Keyboard.dismiss();
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
													onClose();
												} catch (error) {
													Alert.alert('Error', 'Failed to archive contact');
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
						Keyboard.dismiss();
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

// Add/Edit Contact Modal
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
				mediaTypes: ['images'],
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
					setFormData((prev) => ({ ...prev, photo_url: photoUrl }));
				} else {
					Alert.alert('Error', 'Failed to upload photo');
				}
			}
		} catch (error) {
			console.error('Error uploading photo:', error);
			Alert.alert('Error', 'Failed to upload photo');
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

// Main Component
export default function ContactsScreen({ navigation }) {
	const { user } = useAuth();
	const [contacts, setContacts] = useState({ scheduledContacts: [], unscheduledContacts: [] });
	const [refreshing, setRefreshing] = useState(false);
	const [loading, setLoading] = useState(true);
	const [isFormVisible, setIsFormVisible] = useState(false);
	const [isDetailsVisible, setIsDetailsVisible] = useState(false);
	const [selectedContact, setSelectedContact] = useState(null);
	const [isScheduleModalVisible, setIsScheduleModalVisible] = useState(false);
	const [deviceContacts, setDeviceContacts] = useState([]);
	const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);

	async function loadContacts() {
		try {
			if (!user) return;
			const contactsList = await fetchContacts(user.uid);
			setContacts(contactsList);
		} catch (error) {
			console.error('Error loading contacts:', error);
			Alert.alert('Error', 'Failed to load contacts');
		} finally {
			setLoading(false);
		}
	}

	const formatPhoneNumber = (phoneNumber) => {
		const cleaned = phoneNumber.replace(/\D/g, '');
		if (cleaned.length === 10) {
			return `+1${cleaned}`;
		} else if (cleaned.length === 11 && cleaned.startsWith('1')) {
			return `+${cleaned}`;
		}
		return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
	};

	const checkForExistingContact = async (phoneNumber) => {
		try {
			const allContacts = [...contacts.scheduledContacts, ...contacts.unscheduledContacts];
			return allContacts.find(
				(contact) => formatPhoneNumber(contact.phone) === formatPhoneNumber(phoneNumber)
			);
		} catch (error) {
			console.error('Error checking for existing contact:', error);
			return null;
		}
	};

	const handleImportContacts = async () => {
		try {
			const { status } = await Contacts.requestPermissionsAsync();
			if (status !== 'granted') {
				Alert.alert('Permission Denied', 'Please enable contact access in your settings to import contacts.');
				return;
			}

			if (Platform.OS === 'ios') {
				const result = await Contacts.presentContactPickerAsync({
					allowsEditing: false,
					fields: [
						Contacts.Fields.FirstName,
						Contacts.Fields.LastName,
						Contacts.Fields.PhoneNumbers,
						Contacts.Fields.Emails,
						Contacts.Fields.Image,
					],
				});

				if (result) {
					await handleContactSelection(result);
				}
			}
		} catch (error) {
			console.error('Error in handleImportContacts:', error);
			Alert.alert('Error', 'Failed to access contacts');
		}
	};

	const handleContactSelection = async (contact) => {
		try {
			const fullContact = await Contacts.getContactByIdAsync(contact.id, [
				Contacts.Fields.FirstName,
				Contacts.Fields.LastName,
				Contacts.Fields.PhoneNumbers,
				Contacts.Fields.Emails,
				Contacts.Fields.Image,
			]);

			const phoneNumber = contact.phoneNumbers?.[0]?.number;
			if (!phoneNumber) {
				Alert.alert('Invalid Contact', 'Selected contact must have a phone number');
				return;
			}

			const formattedPhone = formatPhoneNumber(phoneNumber);

			const existingContact = await checkForExistingContact(formattedPhone);
			if (existingContact) {
				Alert.alert('Duplicate Contact', 'This contact already exists in your list.');
				return;
			}

			let photoUrl = null;
			if (fullContact.imageAvailable && fullContact.image) {
				try {
					const manipResult = await ImageManipulator.manipulateAsync(
						fullContact.image.uri,
						[{ resize: { width: 300, height: 300 } }],
						{ compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
					);

					photoUrl = await uploadContactPhoto(user.uid, manipResult.uri);
					if (!photoUrl || photoUrl.startsWith('file://')) {
						photoUrl = null;
					}
				} catch (photoError) {
					console.error('Photo processing error:', photoError);
				}
			}

			const contactData = {
				first_name: contact.firstName || '',
				last_name: contact.lastName || '',
				phone: formattedPhone,
				email: contact.emails?.[0]?.email || '',
				notes: '',
				contact_history: [],
				tags: [],
				photo_url: photoUrl,
				frequency: 'weekly',
				created_at: serverTimestamp(),
				last_updated: serverTimestamp(),
				user_id: user.uid,
			};

			const newContact = await addContact(user.uid, contactData);
			await loadContacts();
			setSelectedContact(newContact);
			setIsDetailsVisible(true);
		} catch (error) {
			console.error('Contact import error:', error);
			Alert.alert('Error', 'Failed to import contact: ' + error.message);
		}
	};

	useEffect(() => {
		loadContacts();
	}, [user]);

	const onRefresh = React.useCallback(async () => {
		setRefreshing(true);
		await loadContacts();
		setRefreshing(false);
	}, []);

	const handleAddContact = async (formData) => {
		try {
			await addContact(user.uid, formData);

			if (Platform.OS === 'ios') {
				const { status } = await Contacts.requestPermissionsAsync();
				if (status === 'granted') {
					try {
						const contact = {
							[Contacts.Fields.FirstName]: formData.first_name,
							[Contacts.Fields.LastName]: formData.last_name,
							[Contacts.Fields.PhoneNumbers]: [
								{
									label: 'mobile',
									number: formData.phone,
								},
							],
							[Contacts.Fields.Emails]: formData.email
								? [
										{
											label: 'work',
											email: formData.email,
										},
								  ]
								: [],
						};

						await Contacts.addContactAsync(contact);
						Alert.alert('Success', 'Contact added to OnMyList and iOS Contacts');
					} catch (error) {
						console.error('Error adding to iOS contacts:', error);
						Alert.alert('Partial Success', 'Contact added to OnMyList but failed to add to iOS Contacts');
					}
				}
			}

			setIsFormVisible(false);
			loadContacts();
		} catch (error) {
			console.error('Error adding contact:', error);
			Alert.alert('Error', 'Failed to add contact');
		}
	};

	const handleOpenDetails = (contact) => {
		setSelectedContact(contact);
		setIsDetailsVisible(true);
	};

	if (!user) {
		return (
			<View style={commonStyles.container}>
				<Text style={commonStyles.message}>Please log in to view your contacts</Text>
			</View>
		);
	}

	return (
		<SafeAreaView style={commonStyles.container}>
			<StatusBar style="auto" />

			<View style={styles.header}>
				<Image source={Logo} style={styles.logo} resizeMode="contain" />
			</View>

			<View style={styles.buttonContainer}>
				<TouchableOpacity
					style={[commonStyles.primaryButton, styles.importButton]}
					onPress={handleImportContacts}
				>
					<Icon name="people-outline" size={20} color={colors.background.primary} />
					<Text style={commonStyles.primaryButtonText}>Add Contact</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={styles.newButton}
					onPress={() => {
						setIsFormVisible(true);
					}}
				>
					<Icon name="add-outline" size={20} color={colors.primary} />
					<Text style={styles.newButtonText}>New</Text>
				</TouchableOpacity>
			</View>

			<ScrollView
				style={styles.content}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
			>
				{loading ? (
					<Text style={commonStyles.message}>Loading contacts...</Text>
				) : (
					<>
						{contacts.scheduledContacts.length > 0 && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Scheduled Contacts</Text>
								<View style={styles.grid}>
									{contacts.scheduledContacts.map((contact) => (
										<ContactCard
											key={contact.id}
											contact={contact}
											onPress={handleOpenDetails}
											loadContacts={loadContacts}
										/>
									))}
								</View>
							</View>
						)}

						{contacts.unscheduledContacts.length > 0 && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Other Contacts</Text>
								<View style={styles.grid}>
									{contacts.unscheduledContacts.map((contact) => (
										<ContactCard
											key={contact.id}
											contact={contact}
											onPress={handleOpenDetails}
											loadContacts={loadContacts}
										/>
									))}
								</View>
							</View>
						)}

						{contacts.scheduledContacts.length === 0 && contacts.unscheduledContacts.length === 0 && (
							<Text style={commonStyles.message}>No contacts yet</Text>
						)}
					</>
				)}
			</ScrollView>

			<ContactForm
				visible={isFormVisible}
				onClose={() => {
					setIsFormVisible(false);
				}}
				onSubmit={handleAddContact}
				loadContacts={loadContacts}
			/>

			<ContactDetailsModal
				visible={isDetailsVisible}
				contact={selectedContact}
				setSelectedContact={setSelectedContact}
				onClose={() => {
					setIsDetailsVisible(false);
					setSelectedContact(null);
				}}
				loadContacts={loadContacts}
			/>

			<ScheduleModal
				visible={isScheduleModalVisible}
				contact={selectedContact}
				onClose={() => setIsScheduleModalVisible(false)}
				onSubmit={async (date) => {
					try {
						await updateContact(selectedContact.id, {
							next_contact: date.toISOString(),
						});
						loadContacts();
						setIsScheduleModalVisible(false);
						setIsDetailsVisible(false);
						Alert.alert('Success', 'Contact has been scheduled', [
							{
								text: 'OK',
								onPress: () => {
									navigation.navigate('Calendar', { refresh: Date.now() });
								},
							},
						]);
					} catch (error) {
						console.error('Error scheduling contact:', error);
						Alert.alert('Error', 'Failed to schedule contact');
					}
				}}
				setIsDetailsVisible={setIsDetailsVisible}
				loadContacts={loadContacts}
			/>

			<ContactSearchModal
				visible={isSearchModalVisible}
				contacts={deviceContacts}
				onClose={() => setIsSearchModalVisible(false)}
				onSelectContact={(contact) => {
					setIsSearchModalVisible(false);
					handleContactSelection(contact);
				}}
			/>
		</SafeAreaView>
	);
}
