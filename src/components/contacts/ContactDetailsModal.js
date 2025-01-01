import React, { useState, useEffect } from 'react';
import {
	Alert,
	Modal,
	View,
	Text,
	TouchableOpacity,
	ScrollView,
	KeyboardAvoidingView,
	Platform,
	StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { useCommonStyles } from '../../styles/common';
import { useStyles } from '../../styles/screens/contacts';
import { fetchContactHistory } from '../../utils/firestore';
import { generateTopicSuggestions } from '../../utils/ai';
import CallNotesTab from './tabs/CallNotesTab';
import ScheduleTab from './tabs/ScheduleTab';
import TagsTab from './tabs/TagsTab';
import EditContactTab from './tabs/EditContactTab';
import Constants from 'expo-constants';
import CallOptions from '../general/CallOptions';
import { callHandler } from '../../utils/callHandler';

const ContactDetailsModal = ({ visible, contact, setSelectedContact, onClose, loadContacts }) => {
	const { colors } = useTheme();
	const commonStyles = useCommonStyles();
	const styles = useStyles();

	const [activeTab, setActiveTab] = useState('notes');
	const [history, setHistory] = useState([]);
	const [suggestionCache, setSuggestionCache] = useState({});
	const [suggestions, setSuggestions] = useState([]);
	const [loadingSuggestions, setLoadingSuggestions] = useState(false);
	const [showCallOptions, setShowCallOptions] = useState(false);

	useEffect(() => {
		if (visible) {
			setActiveTab('notes');
			setShowCallOptions(false); // Reset call options when modal opens
		}
	}, [visible]);

	useEffect(() => {
		if (!visible) {
			setShowCallOptions(false);
		}
	}, [visible]);

	useEffect(() => {
		if (contact?.id) {
			fetchContactHistory(contact.id).then((history) => {
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

	useEffect(() => {
		const loadSuggestions = async () => {
			if (!contact) return;

			setLoadingSuggestions(true);
			try {
				const cacheKey = `${contact.id}-suggestions`;
				const cachedSuggestions = suggestionCache[cacheKey];

				if (cachedSuggestions) {
					setSuggestions(cachedSuggestions);
				} else {
					const newSuggestions = await generateTopicSuggestions(contact, history);
					setSuggestions(newSuggestions);

					const newCache = {
						...suggestionCache,
						[cacheKey]: newSuggestions,
					};
					setSuggestionCache(newCache);
					await AsyncStorage.setItem('suggestionCache', JSON.stringify(newCache));
				}
			} catch (error) {
				console.error('Error loading suggestions:', error);
				setSuggestions(['Unable to load suggestions at this time.']);
			} finally {
				setLoadingSuggestions(false);
			}
		};

		loadSuggestions();
	}, [contact, history]);

	if (!contact) {
		return null;
	}

	const renderTab = () => {
		switch (activeTab) {
			case 'notes':
				return (
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
				);
			case 'schedule':
				return (
					<ScheduleTab
						contact={contact}
						setSelectedContact={setSelectedContact}
						loadContacts={loadContacts}
					/>
				);
			case 'tags':
				return <TagsTab contact={contact} setSelectedContact={setSelectedContact} />;
			case 'edit':
				return (
					<EditContactTab
						contact={contact}
						setSelectedContact={setSelectedContact}
						loadContacts={loadContacts}
						onClose={onClose}
					/>
				);
			default:
				return null;
		}
	};

	return (
		<Modal visible={visible} animationType="fade" transparent={true}>
			<KeyboardAvoidingView
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
				style={{ flex: 1 }}
				keyboardVerticalOffset={-70}
			>
				<TouchableOpacity
					style={commonStyles.modalContainer}
					activeOpacity={1}
					onPress={(e) => {
						setShowCallOptions(false);
						onClose();
					}}
				>
					<TouchableOpacity
						style={[commonStyles.modalContent]}
						activeOpacity={1}
						onPress={(e) => e.stopPropagation()}
					>
						<View style={[commonStyles.modalHeader]}>
							<TouchableOpacity
								style={[styles.callIconButton]}
								onPress={() => setShowCallOptions(!showCallOptions)}
							>
								<Text>
									<Icon name="call-outline" size={20} color={colors.background.primary} />
								</Text>
								<CallOptions
									show={showCallOptions}
									contact={contact}
									onClose={() => setShowCallOptions(false)}
								/>
							</TouchableOpacity>

							<View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 50 }}>
								<Text style={commonStyles.modalTitle} numberOfLines={1} adjustsFontSizeToFit>
									{contact.first_name} {contact.last_name}
								</Text>
							</View>
							<TouchableOpacity style={styles.closeButton} onPress={onClose}>
								<Icon name="close-outline" size={24} color={colors.text.secondary} />
							</TouchableOpacity>
						</View>

						<View style={styles.tabBar}>
							<TouchableOpacity
								style={[styles.tabItem, activeTab === 'notes' && styles.activeTab]}
								onPress={() => setActiveTab('notes')}
							>
								<Icon
									name="document-text-outline"
									size={24}
									color={activeTab === 'notes' ? colors.primary : colors.text.secondary}
								/>
								<Text style={[styles.tabLabel, activeTab === 'notes' && styles.activeTabLabel]}>Notes</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.tabItem, activeTab === 'schedule' && styles.activeTab]}
								onPress={() => setActiveTab('schedule')}
							>
								<Icon
									name="calendar-outline"
									size={24}
									color={activeTab === 'schedule' ? colors.primary : colors.text.secondary}
								/>
								<Text style={[styles.tabLabel, activeTab === 'schedule' && styles.activeTabLabel]}>
									Schedule
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.tabItem, activeTab === 'tags' && styles.activeTab]}
								onPress={() => setActiveTab('tags')}
							>
								<Icon
									name="pricetag-outline"
									size={24}
									color={activeTab === 'tags' ? colors.primary : colors.text.secondary}
								/>
								<Text style={[styles.tabLabel, activeTab === 'tags' && styles.activeTabLabel]}>Tags</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.tabItem, activeTab === 'edit' && styles.activeTab]}
								onPress={() => setActiveTab('edit')}
							>
								<Icon
									name="create-outline"
									size={24}
									color={activeTab === 'edit' ? colors.primary : colors.text.secondary}
								/>
								<Text style={[styles.tabLabel, activeTab === 'edit' && styles.activeTabLabel]}>Profile</Text>
							</TouchableOpacity>
						</View>
						<View style={styles.tabContent}>{renderTab()}</View>
					</TouchableOpacity>
				</TouchableOpacity>
			</KeyboardAvoidingView>
		</Modal>
	);
};

export default ContactDetailsModal;
