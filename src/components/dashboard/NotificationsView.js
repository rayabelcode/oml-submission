// src/components/dashboard/NotificationsView.js
import React from 'react';
import { View, Text, ScrollView, RefreshControl, Animated } from 'react-native';
import { useStyles } from '../../styles/screens/dashboard';
import { useTheme } from '../../context/ThemeContext';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';

export function NotificationsView({ reminders, onComplete, loading, onRefresh, refreshing }) {
	const styles = useStyles();
	const { colors } = useTheme();

	const renderRightActions = (progress, dragX) => {
		const trans = dragX.interpolate({
			inputRange: [-100, 0],
			outputRange: [0, 100],
		});

		return (
			<Animated.View
				style={[
					{
						transform: [{ translateX: trans }],
						backgroundColor: colors.danger,
						justifyContent: 'center',
						alignItems: 'center',
						width: 100,
					},
				]}
			>
				<Text
					style={{
						color: colors.background.primary,
						fontWeight: '600',
						fontSize: 16,
					}}
				>
					Delete
				</Text>
			</Animated.View>
		);
	};

	const handleSwipeAction = (reminder) => {
		if (reminder.firestoreId) {
			onComplete(reminder.firestoreId);
		}
	};

	const ReminderCard = ({ reminder }) => {
		const date = reminder.scheduledTime ? new Date(reminder.scheduledTime) : new Date();
		const formattedDate = date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		});

		return (
			<Swipeable
				renderRightActions={(progress, dragX) => renderRightActions(progress, dragX)}
				onSwipeableOpen={() => handleSwipeAction(reminder)}
			>
				<View style={styles.card}>
					<Text style={styles.cardName}>Add Call Notes</Text>
					<Text style={styles.cardDate}>
						Call with {reminder.contactName || 'Contact'} on {formattedDate}
					</Text>
				</View>
			</Swipeable>
		);
	};

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<ScrollView
				style={styles.notificationsContainer}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
				}
			>
				{loading ? (
					<Text style={styles.message}>Loading notifications...</Text>
				) : reminders.length === 0 ? (
					<Text style={styles.message}>No notifications</Text>
				) : (
					reminders.map((reminder, index) => <ReminderCard key={index} reminder={reminder} />)
				)}
			</ScrollView>
		</GestureHandlerRootView>
	);
}
