import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { createStyles } from '../../../styles/components/aiModal';

// Conversation flow blueprint tab
const FlowTab = ({ flow }) => {
	const { colors } = useTheme();
	const styles = createStyles(colors);
	return (
		<View style={styles.tabContent}>
			<Text style={styles.sectionTitle}>Conversation Roadmap</Text>
			{flow?.map((step, index) => (
				<View key={index} style={styles.flowStep}>
					<View style={styles.stepNumber}>
						<Text style={styles.stepNumberText}>{index + 1}</Text>
					</View>
					<View style={styles.stepContent}>
						<Text style={styles.stepTitle}>{step.title}</Text>
						<Text style={styles.stepDescription}>{step.description}</Text>
					</View>
				</View>
			))}
		</View>
	);
};

export default FlowTab;
