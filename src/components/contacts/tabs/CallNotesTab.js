import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useCommonStyles } from '../../../styles/common';
import { useStyles } from '../../../styles/screens/contacts';
import DatePickerModal from '../../modals/DatePickerModal';
import { addContactHistory, fetchContactHistory } from '../../../utils/firestore';
import { generateTopicSuggestions } from '../../../utils/ai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';

const CallNotesTab = ({
	contact,
	history,
	setHistory,
	suggestionCache,
	setSuggestionCache,
	suggestions,
	setSuggestions,
	loadingSuggestions,
	setLoadingSuggestions,
	setSelectedContact,
}) => {
	const { colors } = useTheme();
	const commonStyles = useCommonStyles();
	const styles = useStyles();

	const [callNotes, setCallNotes] = useState('');
	const [callDate, setCallDate] = useState(new Date());
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [editMode, setEditMode] = useState(null);

	const handleAddCallNotes = async (notes, date) => {
		// ... (Keep the existing code)
	};

	const handleEditHistory = async (index, updatedNote) => {
		// ... (Keep the existing code)
	};

	const handleDeleteHistory = async (index) => {
		// ... (Keep the existing code)
	};

	return (
		<ScrollView>
			<View style={styles.tabContent}>
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

				{loadingSuggestions ? (
					<Text style={styles.suggestionsText}>Loading suggestions...</Text>
				) : (
					<TouchableOpacity style={styles.suggestionsContainer} onPress={() => {}}>
						<Text style={styles.suggestionsTitle}>Suggested Topics:</Text>
						{suggestions.map((topic, index) => (
							<Text key={index} style={styles.suggestion}>
								{topic}
							</Text>
						))}
					</TouchableOpacity>
				)}

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
			</View>
		</ScrollView>
	);
};

export default CallNotesTab;
