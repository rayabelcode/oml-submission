import React, { useState, useCallback, useRef, memo } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput } from 'react-native';
import { useStyles } from '../../styles/screens/dashboard';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { REMINDER_TYPES } from '../../../constants/notificationConstants';

const ReminderCard = memo(({ reminder, onComplete, onSnooze, expandedId, setExpandedId, onSubmitNotes }) => {
	const styles = useStyles();
	const { colors } = useTheme();
	const noteInputRef = useRef('');
	const [hasText, setHasText] = useState(false);

	const date = reminder.scheduledTime ? new Date(reminder.scheduledTime) : new Date();
	const formattedDate = date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});

	const isExpanded = expandedId === reminder.firestoreId;

	const handleExpand = useCallback(() => {
		if (isExpanded) {
			setExpandedId(null);
			noteInputRef.current = '';
			setHasText(false);
		} else {
			setExpandedId(reminder.firestoreId);
			noteInputRef.current = '';
			setHasText(false);
		}
	}, [isExpanded, reminder.firestoreId]);

	const handleSubmitNotes = useCallback(() => {
		if (noteInputRef.current.trim()) {
			onSubmitNotes(reminder.firestoreId, noteInputRef.current.trim());
			noteInputRef.current = '';
			setExpandedId(null);
			setHasText(false);
		}
	}, [reminder.firestoreId, onSubmitNotes, setExpandedId]);

	const handleTextChange = useCallback((text) => {
		noteInputRef.current = text;
		setHasText(text.trim().length > 0);
	}, []);

	return (
		<View style={styles.card}>
			<View style={styles.cardContent}>
				<Text style={styles.cardName}>
					{reminder.type === REMINDER_TYPES.FOLLOW_UP
						? 'Call Follow-up'
						: reminder.type === REMINDER_TYPES.CUSTOM_DATE
						? 'Custom Call'
						: 'Recurring Call'}
				</Text>

				<Text style={styles.cardDate}>
					{reminder.type === REMINDER_TYPES.FOLLOW_UP
						? `Add notes for call with ${reminder.contactName || 'Contact'} on ${formattedDate}`
						: `Call ${reminder.contactName || 'Contact'} - ${formattedDate}`}
				</Text>
			</View>

			{reminder.type === REMINDER_TYPES.FOLLOW_UP && isExpanded && (
				<View style={styles.notesContainer}>
					<TextInput
						style={[
							styles.notesInput,
							{
								color: colors.text.primary,
								borderColor: colors.border,
								borderWidth: 1,
								backgroundColor: colors.background.tertiary,
							},
						]}
						multiline
						placeholder="Enter your call notes here..."
						placeholderTextColor={colors.text.secondary}
						defaultValue=""
						onChangeText={handleTextChange}
						autoFocus
					/>
					<TouchableOpacity
						style={[styles.submitButton, !hasText && styles.submitButtonDisabled]}
						onPress={handleSubmitNotes}
						disabled={!hasText}
					>
						<Text style={styles.submitButtonText}>Save Notes</Text>
					</TouchableOpacity>
				</View>
			)}

			<View style={styles.cardActions}>
				{reminder.type === REMINDER_TYPES.FOLLOW_UP ? (
					<>
						<TouchableOpacity style={styles.actionButton} onPress={() => onComplete(reminder.firestoreId)}>
							<Icon name="close-circle-outline" size={24} color={colors.danger} />
							<Text style={[styles.actionText, { color: colors.danger }]}>Remove</Text>
						</TouchableOpacity>

						<View style={styles.actionButtonSeparator} />

						<TouchableOpacity style={styles.actionButton} onPress={handleExpand}>
							<Icon name="create-outline" size={24} color={colors.primary} />
							<Text style={[styles.actionText, { color: colors.primary }]}>
								{isExpanded ? 'Cancel' : 'Add Notes'}
							</Text>
						</TouchableOpacity>
					</>
				) : (
					<>
						<TouchableOpacity style={styles.actionButton} onPress={() => onComplete(reminder.firestoreId)}>
							<Icon name="checkmark-circle-outline" size={24} color={colors.success} />
							<Text style={[styles.actionText, { color: colors.success }]}>Complete</Text>
						</TouchableOpacity>

						<View style={styles.actionButtonSeparator} />

						<TouchableOpacity style={styles.actionButton} onPress={() => onSnooze(reminder)}>
							<Icon name="time-outline" size={24} color={colors.secondary} />
							<Text style={[styles.actionText, { color: colors.secondary }]}>Snooze</Text>
						</TouchableOpacity>
					</>
				)}
			</View>
		</View>
	);
});

export function NotificationsView({ reminders, onComplete, loading, onRefresh, refreshing, onSnooze }) {
	const styles = useStyles();
	const { colors } = useTheme();
	const [expandedId, setExpandedId] = useState(null);

	const handleSubmitNotes = useCallback(
		(reminderId, notes) => {
			onComplete(reminderId, notes);
		},
		[onComplete]
	);

	return (
		<View style={{ flex: 1 }}>
			<ScrollView
				style={styles.notificationsContainer}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
				}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="none"
			>
				{loading ? (
					<Text style={styles.message}>Loading notifications...</Text>
				) : reminders.length === 0 ? (
					<Text style={styles.message}>No notifications</Text>
				) : (
					reminders.map((reminder) => (
						<ReminderCard
							key={reminder.firestoreId}
							reminder={reminder}
							onComplete={onComplete}
							onSnooze={onSnooze}
							expandedId={expandedId}
							setExpandedId={setExpandedId}
							onSubmitNotes={handleSubmitNotes}
						/>
					))
				)}
			</ScrollView>
		</View>
	);
}
