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

		const normalizedNewTag = newTag.trim().toLowerCase();
		const existingTags = contact.tags || [];
		if (existingTags.some((tag) => tag.toLowerCase() === normalizedNewTag)) {
			Alert.alert('Duplicate Tag', 'This tag already exists.');
			setNewTag('');
			return;
		}

		const updatedTags = [...existingTags, newTag.trim()];

		try {
			await updateContact(contact.id, {
				tags: updatedTags,
			});

			setSelectedContact((prev) => ({
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
		try {
			const updatedTags = (contact.tags || []).filter((tag) => tag !== tagToDelete);

			await updateContact(contact.id, {
				tags: updatedTags,
			});

			setSelectedContact((prev) => ({
				...prev,
				tags: updatedTags,
			}));
		} catch (error) {
			Alert.alert('Error', 'Failed to delete tag');
			console.error('Error deleting tag:', error);
		}
	};

	return (
		<View style={[styles.tabContent, { flex: 1, backgroundColor: colors.background.primary }]}>
			<ScrollView
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={{ flexGrow: 1 }}
				scrollEventThrottle={16}
				showsVerticalScrollIndicator={true}
				style={{ width: '100%' }}
			>
				<TouchableOpacity activeOpacity={1} style={{ flex: 1 }}>
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
						{(contact.tags || []).map((tag, index) => (
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
				</TouchableOpacity>
			</ScrollView>
		</View>
	);
};

export default TagsTab;
