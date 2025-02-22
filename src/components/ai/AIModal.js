import React, { useState, useEffect } from 'react';
import { View, Modal, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import MainTab from './AITabs/MainTab';
import FlowTab from './AITabs/FlowTab';
import { generateTopicSuggestions, generateRelationshipInsights } from '../../utils/ai';
import { createStyles } from '../../styles/components/aiModal';

const AIModal = ({ show, onClose, contact, history }) => {
	const { colors } = useTheme();
	const styles = createStyles(colors);
	const [activeTab, setActiveTab] = useState('topics');
	const [loading, setLoading] = useState(true);
	const [content, setContent] = useState(null);

	useEffect(() => {
		loadContent();
	}, []);

	const loadContent = async () => {
		setLoading(true);
		const suggestions = await generateTopicSuggestions(contact, history);

		const hasHistory = history && history.length > 0;
		let conversationFlow;
		let jokes;

		if (hasHistory) {
			const insights = await generateRelationshipInsights(contact, history);
			conversationFlow = insights.conversationFlow;
			jokes = insights.jokes || [];
		} else {
			conversationFlow = [
				{
					title: 'New Connection',
					description: 'Not enough conversation history yet to analyze patterns',
				},
			];
			jokes = [];
		}

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
					<Text style={styles.modalTitle}>AI Suggestions</Text>

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

					<ScrollView style={styles.scrollContent}>
						{loading ? (
							<View style={styles.loadingContainer}>
								<ActivityIndicator size="large" color={colors.primary} />
								<Text style={styles.loadingText}>Generating insights...</Text>
							</View>
						) : (
							<>
								{activeTab === 'topics' && <MainTab content={content} contact={contact} />}
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
