import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { useCommonStyles } from '../../styles/common';
import { useStyles } from '../../styles/screens/contacts';

const TagsModal = ({ visible, onClose, tags, onAddTag, onDeleteTag }) => {
	const { colors } = useTheme();
	const commonStyles = useCommonStyles();
	const styles = useStyles();
	const [newTag, setNewTag] = useState('');

	const handleAddTag = () => {
		if (newTag.trim()) {
			onAddTag(newTag.trim());
			setNewTag('');
		}
	};

	return (
		<Modal visible={visible} animationType="fade" transparent={true}>
			<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
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
									placeholderTextColor={colors.text.secondary}
									value={newTag}
									onChangeText={setNewTag}
									onSubmitEditing={handleAddTag}
								/>
								<TouchableOpacity style={styles.addTagButton} onPress={handleAddTag}>
									<Text style={commonStyles.primaryButtonText}>Add</Text>
								</TouchableOpacity>
							</View>

							<TouchableOpacity style={[commonStyles.primaryButton, styles.doneButton]} onPress={onClose}>
								<Text style={commonStyles.primaryButtonText}>Done</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
};

export default TagsModal;
