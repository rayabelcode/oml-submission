import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, ActivityIndicator, RefreshControl } from 'react-native';
import { useCommonStyles } from '../styles/common';
import { useStyles } from '../styles/screens/stats';
import { useAuth } from '../context/AuthContext';
import { calculateStats } from './stats/statsCalculator';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';

export default function StatsScreen() {
	const { user } = useAuth();
	const { colors } = useTheme();
	const commonStyles = useCommonStyles();
	const styles = useStyles(colors);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [stats, setStats] = useState(null);

	const loadStats = async () => {
		if (!user) return;
		try {
			const calculatedStats = await calculateStats(user.uid);
			setStats(calculatedStats);
		} catch (error) {
			console.error('Error loading stats:', error);
		} finally {
			setLoading(false);
		}
	};

	const onRefresh = async () => {
		setRefreshing(true);
		await loadStats();
		setRefreshing(false);
	};

	useEffect(() => {
		loadStats();
	}, [user]);

	if (loading) {
		return (
			<View style={[commonStyles.container, commonStyles.centered]}>
				<ActivityIndicator size="large" color={colors.primary} />
			</View>
		);
	}

	return (
		<ScrollView
			style={commonStyles.container}
			refreshControl={
				<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
			}
		>
			<View style={styles.statsContainer}>
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Overview</Text>
					<View style={styles.statsGrid}>
						<StatBox
							icon="calendar"
							title="Monthly"
							value={stats?.basic.monthlyContacts}
							colors={colors}
							styles={styles}
						/>
						<StatBox
							icon="flame"
							title="Streak"
							value={stats?.basic.currentStreak}
							colors={colors}
							styles={styles}
						/>
						<StatBox
							icon="people"
							title="Active"
							value={stats?.basic.totalActive}
							colors={colors}
							styles={styles}
						/>
						<StatBox
							icon="analytics"
							title="Weekly Avg"
							value={Math.round(stats?.basic.averageContactsPerWeek)}
							colors={colors}
							styles={styles}
						/>
					</View>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Relationship Types</Text>
					{Object.entries(stats?.detailed.relationshipBreakdown || {}).map(([type, count]) => (
						<View key={type} style={styles.relationshipRow}>
							<Text style={styles.relationshipType}>{type}</Text>
							<Text style={styles.relationshipCount}>{count}</Text>
						</View>
					))}
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Needs Attention</Text>
					{stats?.detailed.needsAttention.map((contact, index) => (
						<View key={index} style={styles.contactRow}>
							<Text style={styles.contactName}>{contact.name}</Text>
							<Text style={styles.lastContact}>
								{contact.lastContact ? new Date(contact.lastContact).toLocaleDateString() : 'Never'}
							</Text>
						</View>
					))}
				</View>
			</View>
		</ScrollView>
	);
}

const StatBox = ({ icon, title, value, colors, styles }) => (
	<View style={styles.statBox}>
		<Icon name={icon} size={24} color={colors.primary} />
		<Text style={styles.statTitle}>{title}</Text>
		<Text style={styles.statValue}>{value}</Text>
	</View>
);
