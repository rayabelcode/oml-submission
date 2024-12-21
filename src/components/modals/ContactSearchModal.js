import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../styles/theme';
import commonStyles from '../../styles/common';
import styles from '../../styles/screens/contacts';

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

export default ContactSearchModal;
