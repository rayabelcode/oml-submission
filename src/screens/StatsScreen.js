import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, Text, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useCommonStyles } from '../styles/common';
import { useStyles } from '../styles/screens/stats';
import { useAuth } from '../context/AuthContext';
import { calculateStats } from './stats/statsCalculator';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { useIsFocused } from '@react-navigation/native';
import { cacheManager } from '../utils/cache';

// Helper to convert day number to name
const getDayName = (dayNum) => {
	const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	return days[dayNum] || 'Not enough data';
};

const StatBox = ({ icon, title, value, colors, styles }) => (
	<View style={styles.statBox}>
		<Icon name={icon} size={24} color={colors.primary} />
		<Text style={styles.statTitle}>{title}</Text>
		<Text style={styles.statValue}>{value || 0}</Text>
	</View>
);

export default function StatsScreen() {
	const { user } = useAuth();
	const { colors, spacing } = useTheme();
	const commonStyles = useCommonStyles();
	const styles = useStyles(colors);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [stats, setStats] = useState(null);
	const [error, setError] = useState(null);
	const scrollViewRef = useRef(null);
	const isFocused = useIsFocused();

	const loadStats = async (showLoading = false) => {
		if (!user) return;
		try {
			setError(null);
			if (showLoading) setLoading(true);

			// Try to get cached stats first
			const cachedStats = await cacheManager.getCachedStats(user.uid);
			if (cachedStats) {
				setStats(cachedStats);
			}

			// Then fetch fresh stats
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

	const onRefresh = async () => {
		setRefreshing(true);
		await loadStats(false);
		setRefreshing(false);
	};

	useEffect(() => {
		loadStats(false);
	}, [user]);

	useEffect(() => {
		if (!isFocused && scrollViewRef.current) {
			scrollViewRef.current.scrollTo({ x: 0, y: 0, animated: false });
		}
	}, [isFocused]);

	if (loading && !stats) {
		return (
			<View style={[commonStyles.container, commonStyles.centered]}>
				<ActivityIndicator size="large" color={colors.primary} />
			</View>
		);
	}

	if (error) {
		return (
			<View style={[commonStyles.container, commonStyles.centered]}>
				<Icon name="alert-circle" size={48} color={colors.danger} />
				<Text style={[styles.message, { color: colors.danger }]}>{error}</Text>
				<TouchableOpacity style={styles.retryButton} onPress={() => loadStats(true)}>
					<Text style={styles.retryText}>Retry</Text>
				</TouchableOpacity>
			</View>
		);
	}

	return (
		<ScrollView
			ref={scrollViewRef}
			showsVerticalScrollIndicator={false}
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
							title="Calls This Month"
							value={stats?.basic.monthlyContacts}
							colors={colors}
							styles={styles}
						/>
						<StatBox
							icon="flame"
							title="Days in a Row"
							value={stats?.basic.currentStreak}
							colors={colors}
							styles={styles}
						/>
						<StatBox
							icon="people"
							title="Total Contacts"
							value={stats?.basic.totalActive}
							colors={colors}
							styles={styles}
						/>
						<StatBox
							icon="analytics"
							title="Avg Calls/Week"
							value={Math.round(stats?.basic.averageContactsPerWeek)}
							colors={colors}
							styles={styles}
						/>
					</View>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Needs Attention</Text>
					{!stats?.detailed.needsAttention?.length ? (
						<Text style={styles.message}>All caught up! No contacts need attention.</Text>
					) : (
						stats.detailed.needsAttention.map((contact, index) => (
							<View key={index} style={styles.contactRow}>
								<Text style={styles.contactName}>{contact.name}</Text>
								<View style={styles.lastContactInfo}>
									<Text style={styles.lastContactDate}>
										{contact.lastContact
											? new Date(contact.lastContact).toLocaleDateString()
											: 'Never contacted'}
									</Text>
									{contact.lastContact && (
										<Text style={styles.lastContactDays}>
											{Math.floor((new Date() - new Date(contact.lastContact)) / 86400000)} days ago
										</Text>
									)}
								</View>
							</View>
						))
					)}
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Activity Insights</Text>
					<View style={styles.insightRow}>
						<Icon name="trending-up" size={24} color={colors.primary} />
						<View style={styles.insightContent}>
							<Text style={styles.insightText}>
								{stats?.trends.ninetyDayTrend > stats?.basic.averageContactsPerWeek
									? "You're making more calls lately!"
									: 'Your calls have decreased'}
							</Text>
							<Text style={styles.trendValue}>{Math.round(stats?.trends.ninetyDayTrend)} calls/week</Text>
							<Text style={styles.trendLabel}>
								vs {Math.round(stats?.basic.averageContactsPerWeek)} average
							</Text>
						</View>
					</View>
					<View style={styles.insightRow}>
						<Icon name="time" size={24} color={colors.primary} />
						<View style={styles.insightContent}>
							<Text style={styles.insightText}>Most active: {getDayName(stats?.detailed.mostActiveDay)}</Text>
						</View>
					</View>
				</View>
			</View>
		</ScrollView>
	);
}
