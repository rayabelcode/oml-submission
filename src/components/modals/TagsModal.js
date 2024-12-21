import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../styles/theme';
import commonStyles from '../../styles/common';
import styles from '../../styles/screens/contacts';

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

export default TagsModal;
