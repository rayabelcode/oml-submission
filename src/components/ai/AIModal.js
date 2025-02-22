import React, { useState, useEffect } from 'react';
import { View, Modal, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import MainTab from './AITabs/MainTab';
import FlowTab from './AITabs/FlowTab';
import { generateTopicSuggestions } from '../../utils/ai';
import { createStyles } from '../../styles/components/aiModal';

// Main AI modal with tab navigation
const AIModal = ({ show, onClose, contact, history }) => {
	const { colors } = useTheme();
	const styles = createStyles(colors);
	const [activeTab, setActiveTab] = useState('main');
	const [loading, setLoading] = useState(true);
	const [content, setContent] = useState(null);

	// Load AI content on mount
	useEffect(() => {
		loadContent();
	}, []);

	// Fetch AI generated content
	const loadContent = async () => {
		setLoading(true);
		const suggestions = await generateTopicSuggestions(contact, history);

		// Create insights from the same data
		const conversationFlow = [
			{
				title: 'Recent Topics',
				description: 'Review previous conversations to identify common themes',
			},
			{
				title: 'Future Plans',
				description: 'Discuss upcoming events or activities mentioned',
			},
		];

		const jokes = ["Here's a lighthearted moment from your last conversation..."];

		setContent({
			suggestions,
			conversationFlow,
			jokes,
		});
		setLoading(false);
	};

	return (
		<Modal visible={show} transparent={true} animationType="fade" onRequestClose={onClose}>
			<View style={styles.modalContainer}>
				<View style={styles.modalContent}>
					<Text style={styles.modalTitle}>AI Conversation Topics</Text>

					<View style={styles.tabSelector}>
						{['Main', 'Insights'].map((tab) => (
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

					<ScrollView style={styles.scrollContent}>
						{loading ? (
							<View style={styles.loadingContainer}>
								<ActivityIndicator size="large" color={colors.primary} />
								<Text style={styles.loadingText}>Generating insights...</Text>
							</View>
						) : (
							<>
								{activeTab === 'main' && <MainTab content={content} contact={contact} />}
								{activeTab === 'insights' && (
									<FlowTab flow={content?.conversationFlow} jokes={content?.jokes} />
								)}
							</>
						)}
					</ScrollView>

					<TouchableOpacity style={styles.closeButton} onPress={onClose}>
						<Icon name="close" size={24} color={colors.text.primary} />
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	);
};

export default AIModal;
