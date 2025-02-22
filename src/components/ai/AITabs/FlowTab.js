import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { createStyles } from '../../../styles/components/aiModal';

const FlowTab = ({ flow, jokes }) => {
	const { colors } = useTheme();
	const styles = createStyles(colors);

	return (
		<View style={styles.tabContent}>
			<Text style={styles.sectionTitle}>Relationship Insights</Text>
			{flow?.map((insight, index) => (
				<View key={index} style={styles.flowStep}>
					<View style={styles.stepNumber}>
						<Text style={styles.stepNumberText}>{index + 1}</Text>
					</View>
					<View style={styles.stepContent}>
						<Text style={styles.stepTitle}>{insight.title}</Text>
						<Text style={styles.stepDescription}>{insight.description}</Text>
					</View>
				</View>
			))}

			{jokes?.length > 0 && (
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Lighthearted Moments</Text>
					{jokes.map((joke, index) => (
						<View key={index} style={styles.jokeCard}>
							<Text style={styles.jokeText}>{joke}</Text>
						</View>
					))}
				</View>
			)}
		</View>
	);
};

export default FlowTab;
