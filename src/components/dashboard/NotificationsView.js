import React, { useState, useCallback, useRef, memo, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, Keyboard } from 'react-native';
import { useStyles } from '../../styles/screens/dashboard';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { REMINDER_TYPES, FREQUENCY_DISPLAY_MAP } from '../../../constants/notificationConstants';
import { AvoidSoftInput, AvoidSoftInputView } from 'react-native-avoid-softinput';

const ReminderCard = memo(({ reminder, onComplete, onSnooze, expandedId, setExpandedId, onSubmitNotes }) => {
	const styles = useStyles();
	const { colors, theme, layout, spacing } = useTheme();
	const [hasText, setHasText] = useState(false);
	const noteInputRef = useRef('');

	const date = reminder.scheduledTime ? new Date(reminder.scheduledTime) : new Date();
	const formattedDate = date.toLocaleDateString('en-US', {
		month: 'numeric',
		day: 'numeric',
		year: 'numeric',
	});

	const isExpanded = expandedId === reminder.firestoreId;

	const handleExpand = useCallback(() => {
		Keyboard.dismiss();
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
			<View
				style={[styles.headerRow, { backgroundColor: colors.reminderTypes[reminder.type.toLowerCase()] }]}
			>
				<View style={styles.titleRow}>
					<Icon
						name={
							reminder.type === REMINDER_TYPES.FOLLOW_UP
								? 'document-text-outline'
								: reminder.type === REMINDER_TYPES.SCHEDULED
								? 'repeat-outline'
								: 'calendar-outline'
						}
						size={24}
						color={colors.text.primary}
						style={styles.titleIcon}
					/>
					<Text style={styles.reminderTitle}>
						{reminder.type === REMINDER_TYPES.FOLLOW_UP
							? 'Follow Up Reminder'
							: reminder.type === REMINDER_TYPES.SCHEDULED
							? 'Recurring Reminder'
							: 'Custom Reminder'}
					</Text>
				</View>
			</View>

			<View style={[styles.cardContent, { borderColor: colors.reminderTypes[reminder.type.toLowerCase()] }]}>
				<Text style={styles.contactName}>{reminder.contactName}</Text>
				<Text style={styles.reminderDescription}>
					{reminder.type === REMINDER_TYPES.FOLLOW_UP
						? `Add notes for the call on ${formattedDate}`
						: reminder.type === REMINDER_TYPES.SCHEDULED
						? `${formattedDate} ${FREQUENCY_DISPLAY_MAP[reminder.frequency] || 'Custom'} Call Reminder`
						: `${formattedDate} Custom Call Reminder`}
				</Text>
			</View>

			{reminder.type === REMINDER_TYPES.FOLLOW_UP && isExpanded && (
				<View
					style={[
						styles.notesContainer,
						{
							borderLeftWidth: 2,
							borderRightWidth: 2,
							borderColor: colors.reminderTypes[reminder.type.toLowerCase()],
						},
					]}
				>
					<TextInput
						style={[
							styles.notesInput,
							{
								backgroundColor: colors.background.tertiary,
								color: colors.text.primary,
								borderColor: colors.border,
								borderWidth: 1,
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
						style={[
							styles.submitButton,
							!hasText && styles.submitButtonDisabled,
							{ backgroundColor: colors.primary },
						]}
						onPress={handleSubmitNotes}
						disabled={!hasText}
					>
						<Text style={[styles.submitButtonText, { color: colors.background.primary }]}>Save Notes</Text>
					</TouchableOpacity>
				</View>
			)}

			<View
				style={[
					styles.cardActions,
					{
						borderColor: colors.reminderTypes[reminder.type.toLowerCase()],
						borderWidth: 2,
						borderBottomLeftRadius: layout.borderRadius.md,
						borderBottomRightRadius: layout.borderRadius.md,
						flexDirection: 'row',
						justifyContent: 'space-between',
						padding: spacing.md,
					},
				]}
			>
				{reminder.type === REMINDER_TYPES.FOLLOW_UP ? (
					<>
						<TouchableOpacity
							style={[
								styles.actionButton,
								{
									flex: 1,
									justifyContent: 'center',
									alignItems: 'center',
									borderRightWidth: 2,
									borderRightColor: colors.reminderTypes[reminder.type.toLowerCase()],
								},
							]}
							onPress={() => onComplete(reminder.firestoreId)}
						>
							<Icon name="close-circle-outline" size={24} color={colors.danger} />
							<Text style={[styles.actionText, { color: colors.danger }]}>Remove</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[
								styles.actionButton,
								{
									flex: 1,
									justifyContent: 'center',
									alignItems: 'center',
								},
							]}
							onPress={handleExpand}
						>
							<Icon name="create-outline" size={24} color={colors.primary} />
							<Text style={[styles.actionText, { color: colors.primary }]}>
								{isExpanded ? 'Cancel' : 'Add Notes'}
							</Text>
						</TouchableOpacity>
					</>
				) : (
					<>
						<TouchableOpacity
							style={[
								styles.actionButton,
								{
									flex: 1,
									justifyContent: 'center',
									alignItems: 'center',
									borderRightWidth: 2,
									borderRightColor: colors.reminderTypes[reminder.type.toLowerCase()],
								},
							]}
							onPress={() => onComplete(reminder.firestoreId)}
						>
							<Icon name="checkmark-circle-outline" size={24} color={colors.success} />
							<Text style={[styles.actionText, { color: colors.success }]}>Complete</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[
								styles.actionButton,
								{
									flex: 1,
									justifyContent: 'center',
									alignItems: 'center',
								},
							]}
							onPress={() => onSnooze(reminder)}
						>
							<Icon name="time-outline" size={24} color={colors.warning} />
							<Text style={[styles.actionText, { color: colors.warning }]}>Snooze</Text>
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

    useEffect(() => {
        AvoidSoftInput.setEnabled(true);
        return () => {
            AvoidSoftInput.setEnabled(false);
        };
    }, []);

    const handleSubmitNotes = useCallback(
        (reminderId, notes) => {
            onComplete(reminderId, notes);
        },
        [onComplete]
    );

    return (
        <View style={{ flex: 1 }}>
            <AvoidSoftInputView style={{ flex: 1 }}>
                <ScrollView
                    style={styles.notificationsContainer}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                    }
                    keyboardShouldPersistTaps="always"
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
            </AvoidSoftInputView>
        </View>
    );
}


