import React from 'react';
import { View, FlatList, Text, ActivityIndicator, RefreshControl } from 'react-native';
import { FollowUpNotification } from '../../utils/FollowUpNotification';
import { useStyles } from '../../styles/screens/dashboard';
import { useTheme } from '../../context/ThemeContext';

export const NotificationsView = ({ reminders, onComplete, loading, onRefresh, refreshing }) => {
	const styles = useStyles();
	const { colors } = useTheme();

	if (loading) {
		return (
			<View style={styles.contactsList}>
				<ActivityIndicator testID="loading-indicator" size="large" color={colors.primary} />
			</View>
		);
	}

	return (
		<View style={styles.contactsList}>
			<FlatList
				testID="reminders-list"
				data={reminders}
				keyExtractor={(item) => item.firestoreId}
				renderItem={({ item }) => (
					<View testID="reminder-item">
						<FollowUpNotification reminder={item} onComplete={onComplete} />
					</View>
				)}
				ListEmptyComponent={() => <Text style={styles.message}>No follow-up reminders</Text>}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
			/>
		</View>
	);
};
