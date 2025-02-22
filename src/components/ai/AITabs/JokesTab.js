import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { createStyles } from '../../../styles/components/aiModal';

// Joke generator tab
const JokesTab = ({ jokes }) => {
	const { colors } = useTheme();
	const styles = createStyles(colors);
	return (
		<View style={styles.tabContent}>
			<Text style={styles.sectionTitle}>Lighthearted Moments</Text>
			{jokes?.map((joke, index) => (
				<View key={index} style={styles.jokeCard}>
					<Text style={styles.jokeText}>{joke}</Text>
				</View>
			))}
		</View>
	);
};

export default JokesTab;
