import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../../context/ThemeContext';
import { useCommonStyles } from '../../../styles/common';
import { useStyles } from '../../../styles/screens/contacts';
import { updateContact } from '../../../utils/firestore';

const TagsTab = ({ contact, setSelectedContact }) => {
	const { colors } = useTheme();
	const commonStyles = useCommonStyles();
	const styles = useStyles();
	const [newTag, setNewTag] = useState('');
	const inputRef = useRef(null);

	const handleAddTag = async () => {
		if (!newTag.trim()) return;

		const updatedTags = [...(contact.tags || []), newTag.trim()];
		try {
			await updateContact(contact.id, { tags: updatedTags });
			setSelectedContact((prev) => ({
				...prev,
				tags: updatedTags,
			}));
			setNewTag('');
			// Keep focus on the input after adding tag
			inputRef.current?.focus();
		} catch (error) {
			Alert.alert('Error', 'Failed to add tag');
		}
	};

	return (
		<ScrollView style={styles.tabContent} keyboardShouldPersistTaps="handled">
			<View style={styles.tagsContainer}>
				{contact.tags?.map((tag, index) => (
					<View key={index} style={styles.tagBubble}>
						<Text style={styles.tagText}>{tag}</Text>
						<TouchableOpacity
							onPress={() => {
								Alert.alert('Delete Tag', `Are you sure you want to delete "${tag}"?`, [
									{ text: 'Cancel', style: 'cancel' },
									{
										text: 'Delete',
										style: 'destructive',
										onPress: async () => {
											const updatedTags = contact.tags.filter((t) => t !== tag);
											await updateContact(contact.id, { tags: updatedTags });
											setSelectedContact((prev) => ({
												...prev,
												tags: updatedTags,
											}));
										},
									},
								]);
							}}
						>
							<Icon name="close-circle" size={20} color={colors.text.secondary} />
						</TouchableOpacity>
					</View>
				))}
			</View>
			<View style={styles.tagInputContainer}>
				<TextInput
					ref={inputRef}
					style={[styles.tagInput, { flex: 1 }]}
					placeholder="Type a tag and press enter..."
					value={newTag}
					onChangeText={setNewTag}
					onSubmitEditing={handleAddTag}
					returnKeyType="done"
					blurOnSubmit={false}
					autoFocus={false}
				/>
			</View>
		</ScrollView>
	);
};

export default TagsTab;
