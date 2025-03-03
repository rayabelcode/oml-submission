import React, { useState, useEffect } from 'react';
import { View, Modal, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import MainTab from './AITabs/MainTab';
import FlowTab from './AITabs/FlowTab';
import { generateTopicSuggestions, generateRelationshipInsights } from '../../utils/ai';
import { createStyles } from '../../styles/components/aiModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AIModal = ({ show, onClose, contact, history }) => {
	const { colors, spacing, layout } = useTheme();
	const styles = createStyles(colors, spacing, layout);
	const [activeTab, setActiveTab] = useState('topics');
	const [loading, setLoading] = useState(true);
	const [content, setContent] = useState(null);

	useEffect(() => {
		loadContent();
	}, []);

	const loadContent = async () => {
		setLoading(true);
		try {
			// Try to get cached content first
			const cacheKey = `${contact.id}-ai-recap`;
			const cachedDataString = await AsyncStorage.getItem(cacheKey);

			if (cachedDataString) {
				const cachedData = JSON.parse(cachedDataString);
				setContent(cachedData);
				setLoading(false);
				return;
			}

			// No cache exists, generate new content
			const suggestions = await generateTopicSuggestions(contact, history);

			const hasHistory = history && history.length > 0;
			let conversationFlow;

			if (hasHistory) {
				const insights = await generateRelationshipInsights(contact, history);
				conversationFlow = insights.conversationFlow;
			} else {
				conversationFlow = [
					{
						title: 'New Connection',
						description: 'Not enough conversation history yet to analyze patterns',
					},
				];
			}

			const newContent = {
				suggestions,
				conversationFlow,
			};

			// Save the generated content to cache
			await AsyncStorage.setItem(cacheKey, JSON.stringify(newContent));

			setContent(newContent);
		} catch (error) {
			console.error('Error loading AI content:', error);
			setContent({
				suggestions: ['Unable to generate suggestions at this time.'],
				conversationFlow: [
					{
						title: 'Error',
						description: 'There was a problem generating insights. Please try again later.',
					},
				],
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<Modal visible={show} transparent={true} animationType="fade" onRequestClose={onClose}>
			<View style={styles.modalContainer}>
				<View style={styles.modalContent}>
					{/* Fixed Height Header */}
					<View style={styles.headerContainer}>
						<View style={styles.headerRow}>
							<View style={styles.headerLeft} />
							<Text style={styles.modalTitle}>AI Suggestions</Text>
							<TouchableOpacity style={styles.headerRight} onPress={onClose}>
								<Icon name="close" size={35} color={colors.warning} />
							</TouchableOpacity>
						</View>
						<View style={styles.tabSelector}>
							{['Topics', 'Insights'].map((tab) => (
								<TouchableOpacity
									key={tab}
									style={[styles.tab, activeTab === tab.toLowerCase() && styles.activeTab]}
									onPress={() => setActiveTab(tab.toLowerCase())}
								>
									<Text style={[styles.tabText, activeTab === tab.toLowerCase() && styles.activeTabText]}>
										{tab}
									</Text>
								</TouchableOpacity>
							))}
						</View>
					</View>

					{/* Content Section */}
					<View style={styles.contentContainer}>
						<ScrollView style={styles.scrollContent} contentContainerStyle={{ flexGrow: 1 }}>
							{loading ? (
								<View style={styles.loadingContainer}>
									<ActivityIndicator size="large" color={colors.primary} />
									<Text style={styles.loadingText}>Generating insights...</Text>
								</View>
							) : (
								<>
									{activeTab === 'topics' && <MainTab content={content} contact={contact} />}
									{activeTab === 'insights' && <FlowTab flow={content?.conversationFlow} />}
								</>
							)}
						</ScrollView>
					</View>
				</View>
			</View>
		</Modal>
	);
};

export default AIModal;
