import React, { useState, useEffect } from 'react';
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
import { AvoidSoftInput } from 'react-native-avoid-softinput';
import { useTheme, spacing } from '../../../context/ThemeContext';
import { useCommonStyles } from '../../../styles/common';
import { useStyles } from '../../../styles/screens/contacts';
import DatePickerModal from '../../modals/DatePickerModal';
import { addContactHistory, fetchContactHistory, updateContact } from '../../../utils/firestore';
import { generateTopicSuggestions } from '../../../utils/ai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import KeyboardDismiss from '../../../components/general/KeyboardDismiss';
import AIModal from '../../ai/AIModal';

const CallNotesTab = ({ contact, history = [], setHistory, setSelectedContact }) => {
	const { colors } = useTheme();
	const commonStyles = useCommonStyles();
	const styles = useStyles();
	const inputAccessoryViewID = 'notesInput';

	const [callNotes, setCallNotes] = useState('');
	const [callDate, setCallDate] = useState(new Date());
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [editMode, setEditMode] = useState(null);
	const [showAISuggestions, setShowAISuggestions] = useState(false);
	const [suggestionCache, setSuggestionCache] = useState({});
	const [suggestions, setSuggestions] = useState([]);
	const [loadingSuggestions, setLoadingSuggestions] = useState(false);
	const [editingText, setEditingText] = useState('');

	useEffect(() => {
		AvoidSoftInput.setEnabled(true); // Enable AvoidSoftInput for this page
		return () => {
			AvoidSoftInput.setEnabled(false); // Disable AvoidSoftInput on unmount
		};
	}, []);

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
						const originalHistory = await fetchContactHistory(contact.id);
						setHistory(originalHistory.sort((a, b) => new Date(b.date) - new Date(a.date)));
					}
				},
			},
		]);
	};

	const handleEditHistory = async (index) => {
		try {
			if (history[index].notes === editingText) {
				setEditMode(null);
				return;
			}

			const updatedHistory = history.map((entry, i) =>
				i === index ? { ...entry, notes: editingText } : { ...entry }
			);

			setHistory(updatedHistory);

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
			setEditingText('');
		} catch (error) {
			console.error('Error editing history:', error);
			Alert.alert('Error', 'Failed to edit history');
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

			if (cachedSuggestions) {
				setSuggestions(cachedSuggestions);
				setLoadingSuggestions(false);
				return;
			}

			const newSuggestions = await generateTopicSuggestions(contact, history);
			setSuggestions(newSuggestions);

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
			keyboardShouldPersistTaps="handled"
		>
			<View style={styles.callNotesSection}>
				<TextInput
					style={styles.callNotesInput}
					multiline
					value={callNotes}
					onChangeText={setCallNotes}
					placeholder="Add call notes..."
					placeholderTextColor={colors.text.secondary}
					inputAccessoryViewID={inputAccessoryViewID}
				/>
				<View style={styles.callNotesControls}>
					<TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
						{callDate.toDateString() === new Date().toDateString() && (
							<Icon name="calendar-outline" size={18} color={colors.text.primary} />
						)}
						<Text style={styles.dateButtonText}>
							{callDate.toDateString() === new Date().toDateString()
								? 'Today'
								: callDate.toLocaleDateString()}
						</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={styles.addNoteButton}
						onPress={() => handleAddCallNotes(callNotes, callDate)}
					>
						<Text style={styles.addNoteButtonText}>Add Note</Text>
					</TouchableOpacity>
				</View>
			</View>

			<View style={styles.sectionSeparator} />

			<TouchableOpacity activeOpacity={1} style={styles.historySection}>
				{/* History Header with AI Button */}
				<View style={styles.historyHeader}>
					<Text style={styles.historyTitle}>Contact History</Text>
					<TouchableOpacity
						style={styles.aiRecapButton}
						onPress={() => {
							handleGetSuggestions();
							setShowAISuggestions(true);
						}}
					>
						<Icon name="bulb-outline" size={16} color={colors.text.secondary} />
						<Text style={styles.aiRecapText}>AI Recap</Text>
					</TouchableOpacity>
				</View>
				{/* Notes History */}
				<View style={styles.noteHistorySection}>
					{history.length > 0 ? (
						history.map((entry, index) => (
							<View key={index} style={styles.historyEntry}>
								<View style={styles.historyEntryHeader}>
									<Text style={styles.historyDate}>{new Date(entry.date).toLocaleDateString()}</Text>
									<View style={styles.historyActions}>
										<TouchableOpacity
											style={styles.historyActionButton}
											onPress={() => {
												if (editMode === index) {
													handleEditHistory(index);
												} else {
													setEditMode(index);
													setEditingText(entry.notes);
												}
											}}
										>
											<Icon
												name={editMode === index ? 'checkmark-outline' : 'create-outline'}
												size={24}
												color={colors.text.secondary}
											/>
										</TouchableOpacity>
										<TouchableOpacity
											style={styles.historyActionButton}
											onPress={() => handleDeleteHistory(index)}
										>
											<Icon name="trash-outline" size={24} color={colors.text.secondary} />
										</TouchableOpacity>
									</View>
								</View>
								{editMode === index ? (
									<TextInput
										style={[styles.historyNotesInput, { color: colors.text.primary }]}
										value={editingText}
										onChangeText={setEditingText}
										multiline
									/>
								) : (
									<Text style={styles.historyNotes}>{entry.notes}</Text>
								)}
							</View>
						))
					) : (
						<Text style={styles.emptyHistoryText}>
							Add call notes above, and your history will appear here!
						</Text>
					)}
				</View>
			</TouchableOpacity>

			{Platform.OS === 'ios' && <KeyboardDismiss inputAccessoryViewID={inputAccessoryViewID} />}

			{showAISuggestions && (
				<AIModal
					show={showAISuggestions}
					onClose={() => setShowAISuggestions(false)}
					contact={contact}
					history={history}
				/>
			)}

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
