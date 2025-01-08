import React from 'react';
import { Text, View, ScrollView } from 'react-native';
import PropTypes from 'prop-types';
import { useStyles } from '../../styles/screens/dashboard';
import { useCommonStyles } from '../../styles/common';

const StatsView = ({ stats }) => {
	const styles = useStyles();
	const commonStyles = useCommonStyles();

	return (
		<ScrollView style={styles.statsContainer}>
			<View style={commonStyles.card}>
				<Text style={styles.statTitle}>This Month</Text>
				<Text style={styles.statValue}>{stats.monthlyContacts}</Text>
				<Text style={styles.statLabel}>Contacts Made</Text>
			</View>

			<View style={commonStyles.card}>
				<Text style={styles.statTitle}>Current Streak</Text>
				<Text style={styles.statValue}>{stats.currentStreak}</Text>
				<Text style={styles.statLabel}>Days</Text>
			</View>

			<View style={commonStyles.card}>
				<Text style={styles.statTitle}>Most Frequent Contacts</Text>
				{stats.frequentContacts.map((contact, index) => (
					<Text key={index} style={styles.statListItem}>
						{contact.name} ({contact.count} times)
					</Text>
				))}
			</View>

			<View style={commonStyles.card}>
				<Text style={styles.statTitle}>Needs Attention</Text>
				{stats.needsAttention.length > 0 ? (
					stats.needsAttention.map((contact, index) => (
						<Text key={index} style={styles.statListItem}>
							{contact.name} (Last:{' '}
							{contact.lastContact === 'Never' ? 'Never' : new Date(contact.lastContact).toLocaleDateString()}
							)
						</Text>
					))
				) : (
					<Text style={styles.congratsMessage}>
						Congratulations! You don't have any contacts that haven't been contacted in the last 30 days.
					</Text>
				)}
			</View>

			<View style={commonStyles.card}>
				<Text style={styles.statTitle}>Total Active Relationships</Text>
				<Text style={styles.statValue}>{stats.totalActive}</Text>
				<Text style={styles.statLabel}>Contacts</Text>
			</View>
		</ScrollView>
	);
};

StatsView.propTypes = {
	stats: PropTypes.shape({
		monthlyContacts: PropTypes.number.isRequired,
		currentStreak: PropTypes.number.isRequired,
		frequentContacts: PropTypes.arrayOf(
			PropTypes.shape({
				name: PropTypes.string.isRequired,
				count: PropTypes.number.isRequired,
			})
		).isRequired,
		needsAttention: PropTypes.arrayOf(
			PropTypes.shape({
				name: PropTypes.string.isRequired,
				lastContact: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]).isRequired,
			})
		).isRequired,
		totalActive: PropTypes.number.isRequired,
	}).isRequired,
};

export default StatsView;
