import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { calculateStats } from './stats/statsCalculator';
import { RELATIONSHIP_TYPES } from '../../constants/relationships';
import Icon from 'react-native-vector-icons/Ionicons';
import { cacheManager } from '../utils/cache';
import { useStyles } from '../styles/screens/stats';
import { SafeAreaView } from 'react-native-safe-area-context';

const StatBox = ({ icon, title, value, subtitle, colors, styles }) => (
	<View style={styles.statBox}>
		<Icon name={icon} size={24} color={colors.primary} />
		<Text style={styles.statTitle}>{title}</Text>
		<Text style={styles.statValue}>{value}</Text>
		{subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
	</View>
);

export const StatsScreen = () => {
	const { colors } = useTheme();
	const styles = useStyles(colors);
	const { user } = useAuth();
	const [stats, setStats] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [refreshing, setRefreshing] = useState(false);

	const loadStats = async (showLoading = false) => {
		if (!user) return;
		try {
			setError(null);
			if (showLoading) setLoading(true);

			// Get cached stats
			const cachedStats = await cacheManager.getCachedStats(user.uid);
			if (cachedStats) {
				setStats(cachedStats);
			}

			// Calculate new stats
			const calculatedStats = await calculateStats(user.uid);
			setStats(calculatedStats);
			await cacheManager.saveStats(user.uid, calculatedStats);
		} catch (error) {
			setError('Unable to load stats. Please try again.');
			console.error('Error loading stats:', error);
		} finally {
			if (showLoading) setLoading(false);
		}
	};

	const onRefresh = useCallback(() => {
		setRefreshing(true);
		loadStats(false).finally(() => setRefreshing(false));
	}, []);

	useEffect(() => {
		loadStats(true);
	}, [user]);

	if (loading && !stats) {
		return (
			<View style={styles.statsContainer}>
				<ActivityIndicator size="large" color={colors.primary} />
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<ScrollView
				style={styles.statsContainer}
				contentContainerStyle={styles.contentContainer}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
			>
				{error ? (
					<View style={styles.section}>
						<Text style={styles.message}>{error}</Text>
					</View>
				) : (
					<>
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Overview</Text>
							<View style={styles.statsGrid}>
								<StatBox
									icon="people"
									title="Total Contacts"
									value={stats?.basic.totalActive || 0}
									subtitle="Contacts that are 'On Your List'"
									colors={colors}
									styles={styles}
								/>
								<StatBox
									icon="alert-circle"
									title="Unscheduled"
									value={stats?.basic.unscheduled || 0}
									subtitle="Contacts with no call scheduled"
									colors={colors}
									styles={styles}
								/>
							</View>
						</View>

						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Contacts by Type</Text>
							<View style={styles.distributionGrid}>
								{stats?.distribution?.map((item) => (
									<View key={item.type} style={styles.distributionItem}>
										<View style={styles.distributionHeader}>
											<Icon
												name={RELATIONSHIP_TYPES[item.type]?.icon || 'people'}
												size={24}
												color={item.color}
											/>
											<Text style={styles.distributionLabel}>
												{RELATIONSHIP_TYPES[item.type]?.label || item.type}
											</Text>
										</View>
										<Text style={styles.distributionCount}>{item.count}</Text>
										<Text style={styles.distributionPercentage}>{item.percentage}%</Text>
									</View>
								))}
							</View>
						</View>
					</>
				)}
			</ScrollView>
		</View>
	);
};

export default StatsScreen;
