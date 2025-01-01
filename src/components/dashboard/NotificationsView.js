import React from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useStyles } from '../../styles/screens/dashboard';
import { useTheme } from '../../context/ThemeContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/Ionicons';

export function NotificationsView({ 
    reminders, 
    onComplete, 
    loading, 
    onRefresh, 
    refreshing,
    onAddNotes,
    onSnooze 
}) {
    const styles = useStyles();
    const { colors } = useTheme();

    const ReminderCard = ({ reminder }) => {
        const date = reminder.scheduledTime ? new Date(reminder.scheduledTime) : new Date();
        const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });

        return (
            <View style={styles.card}>
                <View style={styles.cardContent}>
                    <Text style={styles.cardName}>Call Follow-up</Text>
                    <Text style={styles.cardDate}>
                        Add notes for call with {reminder.contactName || 'Contact'} on {formattedDate}
                    </Text>
                </View>
                
                <View style={styles.cardActions}>
                    <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => onComplete(reminder.firestoreId)}
                    >
                        <Icon name="close-circle-outline" size={24} color={colors.danger} />
                        <Text style={[styles.actionText, { color: colors.danger }]}>Remove</Text>
                    </TouchableOpacity>

                    <View style={styles.actionButtonSeparator} />

                    <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => onAddNotes(reminder)}
                    >
                        <Icon name="create-outline" size={24} color={colors.primary} />
                        <Text style={[styles.actionText, { color: colors.primary }]}>Add Notes</Text>
                    </TouchableOpacity>

                    <View style={styles.actionButtonSeparator} />

                    <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => onSnooze(reminder)}
                    >
                        <Icon name="time-outline" size={24} color={colors.secondary} />
                        <Text style={[styles.actionText, { color: colors.secondary }]}>Snooze</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ScrollView
                style={styles.notificationsContainer}
                refreshControl={
                    <RefreshControl 
                        refreshing={refreshing} 
                        onRefresh={onRefresh} 
                        tintColor={colors.primary}
                    />
                }
            >
                {loading ? (
                    <Text style={styles.message}>Loading notifications...</Text>
                ) : reminders.length === 0 ? (
                    <Text style={styles.message}>No notifications</Text>
                ) : (
                    reminders.map((reminder, index) => (
                        <ReminderCard key={index} reminder={reminder} />
                    ))
                )}
            </ScrollView>
        </GestureHandlerRootView>
    );
}
