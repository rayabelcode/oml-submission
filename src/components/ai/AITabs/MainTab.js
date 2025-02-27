import React from 'react';
import { View, Text } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { createStyles } from '../../../styles/components/aiModal';
import { useTheme } from '../../../context/ThemeContext';
import { checkUpcomingBirthday } from '../../../utils/ai';

const MainTab = ({ content, contact }) => {
	const { colors, spacing, layout } = useTheme();
	const styles = createStyles(colors, spacing, layout);
	const upcomingBirthday = checkUpcomingBirthday(contact);

	return (
		<View style={styles.tabContent}>
			{upcomingBirthday && (
				<View style={styles.birthdayAlert}>
					<Icon name="gift" size={24} color={colors.primary} />
					<Text style={styles.birthdayText}>Birthday on {upcomingBirthday}!</Text>
				</View>
			)}

			<View style={styles.section}>
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
