import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { TabView, SceneMap } from 'react-native-tab-view';
import { useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { useCommonStyles } from '../../styles/common';
import { useStyles } from '../../styles/screens/contacts';
import { updateContact, fetchContactHistory, deleteContact, archiveContact } from '../../utils/firestore';
import { generateTopicSuggestions } from '../../utils/ai';
import CallNotesTab from '../contacts/tabs/CallNotesTab';
import ScheduleTab from '../contacts/tabs/ScheduleTab';
import TagsTab from '../contacts/tabs/TagsTab';
import EditContactTab from '../contacts/tabs/EditContactTab';
import DatePickerModal from '../modals/DatePickerModal';

const ContactDetailsModal = ({ visible, contact, setSelectedContact, onClose, loadContacts }) => {
	const { colors } = useTheme();
	const commonStyles = useCommonStyles();
	const styles = useStyles();
	const layout = useWindowDimensions();
	const { user } = useAuth();

	const [index, setIndex] = useState(0);
	const [routes] = useState([
		{ key: 'notes', icon: 'document-text-outline' },
		{ key: 'schedule', icon: 'calendar-outline' },
		{ key: 'tags', icon: 'pricetag-outline' },
		{ key: 'edit', icon: 'create-outline' },
	]);

	const [history, setHistory] = useState([]);
	const [suggestionCache, setSuggestionCache] = useState({});
	const [suggestions, setSuggestions] = useState([]);
	const [loadingSuggestions, setLoadingSuggestions] = useState(false);

	useEffect(() => {
		if (visible) {
			setIndex(0);
		}
	}, [visible]);

	useEffect(() => {
		if (contact?.id) {
			fetchContactHistory(contact?.id).then((history) => {
				const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
				setHistory(sortedHistory);
			});
		}
	}, [contact]);

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

	if (!contact) {
		return null;
	}

	const renderScene = SceneMap({
		notes: () => (
			<CallNotesTab
				contact={contact}
				history={history}
				setHistory={setHistory}
				suggestionCache={suggestionCache}
				setSuggestionCache={setSuggestionCache}
				suggestions={suggestions}
				setSuggestions={setSuggestions}
				loadingSuggestions={loadingSuggestions}
				setLoadingSuggestions={setLoadingSuggestions}
				setSelectedContact={setSelectedContact}
			/>
		),
		schedule: () => <ScheduleTab contact={contact} setSelectedContact={setSelectedContact} />,
		tags: () => <TagsTab contact={contact} setSelectedContact={setSelectedContact} />,
		edit: () => (
			<EditContactTab
				contact={contact}
				setSelectedContact={setSelectedContact}
				loadContacts={loadContacts}
				onClose={onClose}
			/>
		),
	});

	const renderTabBar = (props) => (
		<View style={styles.tabBar}>
			{props.navigationState.routes.map((route, i) => (
				<TouchableOpacity
					key={route.key}
					style={[styles.tabItem, index === i && styles.activeTab]}
					onPress={() => setIndex(i)}
				>
					<Icon name={route.icon} size={24} color={index === i ? colors.primary : colors.text.secondary} />
				</TouchableOpacity>
			))}
		</View>
	);

	return (
		<Modal visible={visible} animationType="fade" transparent={true}>
			<TouchableOpacity style={commonStyles.modalContainer} activeOpacity={1} onPress={onClose}>
				<TouchableOpacity
					style={commonStyles.modalContent}
					activeOpacity={1}
					onPress={(e) => e.stopPropagation()}
				>
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
						onIndexChange={setIndex}
						initialLayout={{ width: layout.width }}
						renderTabBar={renderTabBar}
					/>
				</TouchableOpacity>
			</TouchableOpacity>
		</Modal>
	);
};

export default ContactDetailsModal;
