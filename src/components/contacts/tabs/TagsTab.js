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
        
        // Check for duplicates (case insensitive)
        const normalizedNewTag = newTag.trim().toLowerCase();
        const existingTags = contact.tags || [];
        if (existingTags.some(tag => tag.toLowerCase() === normalizedNewTag)) {
            Alert.alert('Duplicate Tag', 'This tag already exists.');
            setNewTag('');
            return;
        }

        const updatedTags = [...existingTags, newTag.trim()];
        
        try {
            // Update Firestore
            await updateContact(contact.id, { 
                tags: updatedTags,
            });

            // Update local state immediately
            setSelectedContact(prev => ({
                ...prev,
                tags: updatedTags,
            }));
            
            // Clear input and maintain focus
            setNewTag('');
            inputRef.current?.focus();
        } catch (error) {
            Alert.alert('Error', 'Failed to add tag');
            console.error('Error adding tag:', error);
        }
    };

    const handleDeleteTag = async (tagToDelete) => {
        try {
            const updatedTags = (contact.tags || []).filter(tag => tag !== tagToDelete);
            
            // Update Firestore
            await updateContact(contact.id, {
                tags: updatedTags,
            });

            // Update local state immediately
            setSelectedContact(prev => ({
                ...prev,
                tags: updatedTags,
            }));
        } catch (error) {
            Alert.alert('Error', 'Failed to delete tag');
            console.error('Error deleting tag:', error);
        }
    };

    return (
        <ScrollView style={styles.tabContent} keyboardShouldPersistTaps="handled">
            <View style={styles.tagsContainer}>
                {(contact.tags || []).map((tag, index) => (
                    <View key={index} style={styles.tagBubble}>
                        <Text style={styles.tagText}>{tag}</Text>
                        <TouchableOpacity
                            onPress={() => {
                                Alert.alert(
                                    'Delete Tag',
                                    `Are you sure you want to delete "${tag}"?`,
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                            text: 'Delete',
                                            style: 'destructive',
                                            onPress: () => handleDeleteTag(tag),
                                        },
                                    ]
                                );
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
                    placeholder="Type a new tag and press enter..."
                    value={newTag}
                    onChangeText={setNewTag}
                    onSubmitEditing={handleAddTag}
                    returnKeyType="done"
                    blurOnSubmit={false}
                />
            </View>
        </ScrollView>
    );
};

export default TagsTab;
