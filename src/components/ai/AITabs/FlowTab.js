import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { createStyles } from '../../../styles/components/aiModal';

const FlowTab = ({ flow }) => {
	const { colors, spacing, layout } = useTheme();
	const styles = createStyles(colors, spacing, layout);

	return (
		<View style={styles.tabContent}>
			{flow?.map((insight, index) => (
				<View key={index} style={styles.flowStep}>
					<View style={styles.stepContent}>
						<Text style={styles.stepTitle}>{insight.title}</Text>
						<Text style={styles.stepDescription}>{insight.description}</Text>
					</View>
				</View>
			))}
		</View>
	);
};

export default FlowTab;
