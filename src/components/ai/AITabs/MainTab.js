import React from 'react';
import { View, Text } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { createStyles } from '../../../styles/components/aiModal';
import { useTheme } from '../../../context/ThemeContext';
import { checkUpcomingBirthday } from '../../../utils/ai';

// Main tab with suggestions and birthday alerts
const MainTab = ({ content, contact }) => {
    const { colors } = useTheme();
    const styles = createStyles(colors);
	const upcomingBirthday = checkUpcomingBirthday(contact);

	return (
		<View style={styles.tabContent}>
			{upcomingBirthday && (
				<View style={styles.birthdayAlert}>
					<Icon name="gift-outline" size={24} color={colors.primary} />
					<Text style={styles.birthdayText}>Birthday coming up on {upcomingBirthday}!</Text>
				</View>
			)}

			{content?.keyMoments?.length > 0 && (
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Key Moments</Text>
					{content.keyMoments.map((moment, index) => (
						<View key={index} style={styles.momentCard}>
							<Text style={styles.momentText}>{moment}</Text>
						</View>
					))}
				</View>
			)}

			<View style={styles.section}>
				<Text style={styles.sectionTitle}>Suggested Topics</Text>
				{content?.suggestions?.map((suggestion, index) => (
					<View key={index} style={styles.suggestionCard}>
						<Text style={styles.suggestionText}>{suggestion}</Text>
					</View>
				))}
			</View>
		</View>
	);
};

export default MainTab;
