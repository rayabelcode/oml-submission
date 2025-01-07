import React, { useState } from 'react';
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	ScrollView,
	Alert,
	Platform,
	Modal,
	ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useCommonStyles } from '../../../styles/common';
import { useStyles } from '../../../styles/screens/contacts';
import DatePickerModal from '../../modals/DatePickerModal';
import { addContactHistory, fetchContactHistory, updateContact } from '../../../utils/firestore';
import { generateTopicSuggestions } from '../../../utils/ai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';

const CallNotesTab = ({ contact, history = [], setHistory, setSelectedContact }) => {
	const { colors } = useTheme();
	const commonStyles = useCommonStyles();
	const styles = useStyles();

	const [callNotes, setCallNotes] = useState('');
	const [callDate, setCallDate] = useState(new Date());
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [editMode, setEditMode] = useState(null);
	const [showAISuggestions, setShowAISuggestions] = useState(false);
	const [suggestionCache, setSuggestionCache] = useState({});
	const [suggestions, setSuggestions] = useState([]);
	const [loadingSuggestions, setLoadingSuggestions] = useState(false);

	const handleAddCallNotes = async (notes, date) => {
		if (!notes.trim()) {
			Alert.alert('Error', 'Please enter call notes');
			return;
		}

		try {
			const newHistoryEntry = {
				notes: notes,
				date: date.toISOString(),
			};

			// Update local state immediately
			const newHistory = [newHistoryEntry, ...history];
			setHistory(newHistory);

			// Update Firestore
			await addContactHistory(contact.id, newHistoryEntry);

			// Update the contact object
			const updatedContact = {
				...contact,
				contact_history: newHistory,
			};
			setSelectedContact(updatedContact);

			// Clear suggestions cache for this contact
			const cacheKey = `${contact.id}-suggestions`;
			const newCache = { ...suggestionCache };
			delete newCache[cacheKey];
			setSuggestionCache(newCache);
			await AsyncStorage.setItem('suggestionCache', JSON.stringify(newCache));

			setCallNotes('');
			setCallDate(new Date());
		} catch (error) {
			// Revert local state on error
			console.error('Error adding call notes:', error);
			Alert.alert('Error', 'Failed to add call notes');
			const updatedHistory = await fetchContactHistory(contact.id);
			setHistory(updatedHistory.sort((a, b) => new Date(b.date) - new Date(a.date)));
		}
	};

	const handleDeleteHistory = async (index) => {
		Alert.alert('Delete Entry', 'Are you sure you want to delete this entry?', [
			{ text: 'Cancel', style: 'cancel' },
			{
				text: 'Delete',
				style: 'destructive',
				onPress: async () => {
					try {
						// Update local state immediately
						const updatedHistory = [...history];
						updatedHistory.splice(index, 1);
						setHistory(updatedHistory);

						// Update Firestore
						await updateContact(contact.id, {
							contact_history: updatedHistory,
						});

						// Update the contact object
						const updatedContact = {
							...contact,
							contact_history: updatedHistory,
						};
						setSelectedContact(updatedContact);

						// Clear suggestions cache for this contact
						const cacheKey = `${contact.id}-suggestions`;
						const newCache = { ...suggestionCache };
						delete newCache[cacheKey];
						setSuggestionCache(newCache);
						await AsyncStorage.setItem('suggestionCache', JSON.stringify(newCache));
					} catch (error) {
						console.error('Error deleting history:', error);
						Alert.alert('Error', 'Failed to delete history entry');
						// Revert local state on error
						const originalHistory = await fetchContactHistory(contact.id);
						setHistory(originalHistory.sort((a, b) => new Date(b.date) - new Date(a.date)));
					}
				},
			},
		]);
	};

	const handleEditHistory = async (index, updatedNote) => {
		try {
			// Update local state immediately
			const updatedHistory = [...history];
			updatedHistory[index].notes = updatedNote;
			setHistory(updatedHistory);

			// Update Firestore
			await updateContact(contact.id, {
				contact_history: updatedHistory,
			});

			// Update the contact object
			const updatedContact = {
				...contact,
				contact_history: updatedHistory,
			};
			setSelectedContact(updatedContact);

			setEditMode(null);
		} catch (error) {
			console.error('Error editing history:', error);
			Alert.alert('Error', 'Failed to edit history');
			// Revert local state on error
			const originalHistory = await fetchContactHistory(contact.id);
			setHistory(originalHistory.sort((a, b) => new Date(b.date) - new Date(a.date)));
		}
	};

	const handleGetSuggestions = async () => {
		if (!contact) return;

		setLoadingSuggestions(true);
		try {
			const cacheKey = `${contact.id}-suggestions`;
			const cachedSuggestions = suggestionCache[cacheKey];

			// If there are cached suggestions and no new calls have been added, use cache
			if (cachedSuggestions) {
				setSuggestions(cachedSuggestions);
				setLoadingSuggestions(false);
				return;
			}

			// Generate new suggestions only if no cache exists or new call was added
			const newSuggestions = await generateTopicSuggestions(contact, history);
			setSuggestions(newSuggestions);

			// Update cache
			const newCache = {
				...suggestionCache,
				[cacheKey]: newSuggestions,
			};
			setSuggestionCache(newCache);
			await AsyncStorage.setItem('suggestionCache', JSON.stringify(newCache));
		} catch (error) {
			console.error('Error loading suggestions:', error);
			setSuggestions(['Unable to load suggestions at this time.']);
		} finally {
			setLoadingSuggestions(false);
		}
	};

	return (
		<ScrollView
			style={[styles.tabContent, { flex: 1 }]}
			contentContainerStyle={{ paddingBottom: 20 }}
			scrollEnabled={true}
			showsVerticalScrollIndicator={false}
		>
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

				<TouchableOpacity
					style={styles.aiButton}
					onPress={() => {
						handleGetSuggestions();
						setShowAISuggestions(true);
					}}
				>
					<Icon name="bulb-outline" size={22} color="#FFFFFF" />
					<Text style={styles.aiButtonText}>Get Conversation Topics</Text>
				</TouchableOpacity>
			</View>

			<TouchableOpacity activeOpacity={1} style={styles.historySection}>
				<Text style={styles.sectionTitle}>Contact History</Text>
				{history.length > 0 ? (
					history.map((entry, index) => (
						<View key={index} style={styles.historyEntry}>
							<Text style={styles.historyDate}>{new Date(entry.date).toLocaleDateString()}</Text>
							{editMode === index ? (
								<TextInput
									style={[styles.historyNotesInput, { color: colors.text.primary }]}
									value={entry.notes}
									onChangeText={(text) => {
										const updatedHistory = [...history];
										updatedHistory[index].notes = text;
										setHistory(updatedHistory);
									}}
									multiline
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
				) : (
					<Text style={styles.emptyHistoryText}>
						Add your contact history above to view your call history...
					</Text>
				)}
			</TouchableOpacity>

			<Modal
				visible={showAISuggestions}
				transparent={true}
				animationType="fade"
				onRequestClose={() => setShowAISuggestions(false)}
			>
				<View style={styles.aiModalContainer}>
					<View style={styles.aiModalContent}>
						<View style={styles.modalTitleContainer}>
							<Icon name="bulb-outline" size={24} color={colors.primary} />
							<Text style={styles.sectionTitle}>Conversation Topics</Text>
						</View>
						<ScrollView style={styles.aiModalScrollContent}>
							{loadingSuggestions ? (
								<View style={styles.loadingContainer}>
									<ActivityIndicator size="large" color={colors.primary} />
									<Text style={[styles.suggestionsText, { marginTop: 20 }]}>Generating suggestions...</Text>
								</View>
							) : (
								suggestions.map((suggestion, index) => (
									<Text key={index} style={styles.suggestion}>
										{suggestion}
									</Text>
								))
							)}
						</ScrollView>
						<TouchableOpacity style={styles.closeButton} onPress={() => setShowAISuggestions(false)}>
							<Icon name="close" size={24} color="#000000" />
						</TouchableOpacity>
					</View>
				</View>
			</Modal>

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
		</ScrollView>
	);
};

export default CallNotesTab;
