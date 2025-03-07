import React, { useState, useCallback, useRef, memo, useMemo } from 'react';
import {
	View,
	Text,
	ScrollView,
	RefreshControl,
	TouchableOpacity,
	TextInput,
	Keyboard,
	KeyboardAvoidingView,
	Platform,
} from 'react-native';
import { useStyles } from '../../styles/screens/dashboard';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { REMINDER_TYPES, FREQUENCY_DISPLAY_MAP } from '../../../constants/notificationConstants';
import CallOptions from '../../components/general/CallOptions';
import { getContactById } from '../../utils/firestore';
import { computeSnoozeStats } from '../../utils/scheduler/snoozeHandler';

const ReminderCard = memo(({ reminder, onComplete, onSnooze, expandedId, setExpandedId, onSubmitNotes }) => {
	const styles = useStyles();
	const { colors, theme, layout, spacing } = useTheme();
	const [hasText, setHasText] = useState(false);
	const noteInputRef = useRef('');
	const [showCallOptions, setShowCallOptions] = useState(false);
	const [selectedContact, setSelectedContact] = useState(null);

	// Get snooze stats directly from the reminder
	const snoozeStats = useMemo(() => computeSnoozeStats(reminder), [reminder]);

	const date = reminder.scheduledTime ? new Date(reminder.scheduledTime) : new Date();
	const formattedDate = date.toLocaleDateString('en-US', {
		month: 'numeric',
		day: 'numeric',
		year: 'numeric',
	});

	const isExpanded = expandedId === reminder.firestoreId;

	const cardColorType =
		reminder.snoozed === true || reminder.status === 'snoozed' ? 'snoozed' : reminder.type.toLowerCase();

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
			<View style={[styles.headerRow, { backgroundColor: colors.reminderTypes[cardColorType] }]}>
				<View style={styles.titleRow}>
					<Icon
						name={
							reminder.snoozed === true || reminder.status === 'snoozed'
								? 'moon-outline'
								: reminder.type === REMINDER_TYPES.FOLLOW_UP
								? 'document-text-outline'
								: reminder.type === REMINDER_TYPES.SCHEDULED
								? 'sync-outline'
								: 'calendar-outline'
						}
						size={24}
						color={colors.text.primary}
						style={styles.titleIcon}
					/>
					<Text style={styles.reminderTitle}>
						{reminder.snoozed === true || reminder.status === 'snoozed'
							? `Snoozed (${
									reminder.type === REMINDER_TYPES.SCHEDULED
										? 'Recurring'
										: reminder.type === REMINDER_TYPES.CUSTOM_DATE
										? 'Custom'
										: reminder.type === REMINDER_TYPES.FOLLOW_UP
										? 'Follow Up'
										: 'Reminder'
							  })`
							: reminder.type === REMINDER_TYPES.FOLLOW_UP
							? 'Follow Up Notes'
							: reminder.type === REMINDER_TYPES.SCHEDULED
							? 'Recurring Reminder'
							: 'Custom Reminder'}
					</Text>
				</View>
			</View>

			<View style={[styles.cardContent, { borderColor: colors.reminderTypes[cardColorType] }]}>
				<Text style={styles.contactName}>{reminder.contactName}</Text>
				<Text style={styles.reminderDescription}>
					{reminder.type === REMINDER_TYPES.FOLLOW_UP
						? `Add notes for your ${formattedDate} call`
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
							borderLeftWidth: 4,
							borderRightWidth: 4,
							borderColor: colors.reminderTypes[cardColorType],
						},
					]}
				>
					{Platform.OS === 'ios' ? (
						<KeyboardAvoidingView behavior="padding">
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
						</KeyboardAvoidingView>
					) : (
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
					)}
					<View style={styles.submitButtonContainer}>
						<TouchableOpacity
							style={[
								styles.submitButton,
								!hasText && styles.submitButtonDisabled,
								{ backgroundColor: colors.primary },
							]}
							onPress={handleSubmitNotes}
							disabled={!hasText}
						>
							<Text style={[styles.submitButtonText]}>Save Notes</Text>
						</TouchableOpacity>
					</View>
				</View>
			)}

			<View
				style={[
					styles.cardActions,
					{
						borderColor: colors.reminderTypes[cardColorType],
						borderWidth: 4,
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
									borderRightWidth: 3,
									borderRightColor: colors.reminderTypes[cardColorType],
								},
							]}
							onPress={handleExpand}
						>
							<Icon
								name={isExpanded ? 'arrow-undo-outline' : 'add-circle-outline'}
								size={24}
								color={colors.primary}
							/>
							<Text style={[styles.actionText, { color: colors.primary }]}>
								{isExpanded ? 'Cancel' : 'Notes'}
							</Text>
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
							onPress={() => onComplete(reminder.firestoreId)}
						>
							<Icon name="close-circle-outline" size={24} color={colors.danger} />
							<Text style={[styles.actionText, { color: colors.danger }]}>Clear</Text>
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
									borderRightWidth: 3,
									borderRightColor: colors.reminderTypes[cardColorType],
								},
							]}
							onPress={async () => {
								const contact = await getContactById(reminder.contact_id);
								if (!contact) {
									console.warn('Could not fetch contact details');
									return;
								}
								setSelectedContact({
									...contact,
									first_name: contact.first_name,
									last_name: contact.last_name,
									phone: contact.phone,
								});
								setShowCallOptions(true);
							}}
						>
							<Icon name="chatbox-ellipses-outline" size={24} color={colors.success} />
							<Text style={[styles.actionText, { color: colors.success }]}>Contact</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[
								styles.actionButton,
								{
									flex: 1,
									justifyContent: 'center',
									alignItems: 'center',
									position: 'relative', // For badge positioning
								},
							]}
							onPress={() => onSnooze(reminder)}
						>
							<Icon name="time-outline" size={24} color={colors.action} />
							<Text style={[styles.actionText, { color: colors.action }]}>Options</Text>
						</TouchableOpacity>
					</>
				)}
			</View>
			{selectedContact && (
				<CallOptions
					show={showCallOptions}
					contact={selectedContact}
					onClose={() => {
						setShowCallOptions(false);
						setSelectedContact(null);
					}}
					reminder={reminder}
					onComplete={onComplete}
				/>
			)}
		</View>
	);
});

export function NotificationsView({ reminders, onComplete, loading, onRefresh, refreshing, onSnooze }) {
	const styles = useStyles();
	const { colors } = useTheme();
	const [expandedId, setExpandedId] = useState(null);

	const handleSubmitNotes = useCallback((reminderId, notes) => onComplete(reminderId, notes), [onComplete]);

	const sortedReminders = useMemo(() => {
		if (!reminders || reminders.length === 0) return [];
		return [...reminders].sort((a, b) => {
			const dateA = new Date(a.scheduledTime || 0);
			const dateB = new Date(b.scheduledTime || 0);
			return dateA - dateB;
		});
	}, [reminders]);

	return (
		<ScrollView
			style={[styles.notificationsContainer, { backgroundColor: 'transparent' }]}
			refreshControl={
				<RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
			}
			keyboardShouldPersistTaps="always"
			keyboardDismissMode="none"
		>
			{loading ? (
				<Text style={styles.message}>Loading notifications...</Text>
			) : !reminders || sortedReminders.length === 0 ? (
				<Text style={styles.message}>No notifications</Text>
			) : (
				sortedReminders.map((reminder, index) => (
					<ReminderCard
						key={reminder.firestoreId || `reminder-${index}`}
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
	);
}
