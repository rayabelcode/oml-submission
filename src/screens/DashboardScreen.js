import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Bell, MessageCircle, Clock, Plus } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { fetchReminders, completeReminder } from '../utils/firestore';

export default function DashboardScreen() {
    const { user } = useAuth();
    const [reminders, setReminders] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    async function loadReminders() {
        try {
            if (!user) return;

            const remindersList = await fetchReminders(user.uid);
            setReminders(remindersList);
        } catch (error) {
            console.error('Error fetching reminders:', error.message);
            Alert.alert('Error', 'Failed to load reminders');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadReminders();
    }, [user]);

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        await loadReminders();
        setRefreshing(false);
    }, []);

    async function handleCompleteReminder(reminderId) {
        try {
            await completeReminder(reminderId);
            loadReminders();
            Alert.alert('Success', 'Reminder marked as completed');
        } catch (error) {
            console.error('Error completing reminder:', error.message);
            Alert.alert('Error', 'Failed to complete reminder');
        }
    }

    const ReminderCard = ({ id, title, description, due_date, contact, reminder_type }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => {
                Alert.alert(title, `${description}\n\nContact: ${contact?.name || 'No contact'}`, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Mark Complete',
                        onPress: () => handleCompleteReminder(id),
                        style: 'default',
                    },
                ]);
            }}
        >
            <View style={styles.cardHeader}>
                <Bell size={20} color="#007AFF" />
                <Text style={styles.cardTitle}>{title}</Text>
            </View>
            {description && (
                <Text style={styles.cardDescription} numberOfLines={2}>
                    {description}
                </Text>
            )}
            <Text style={styles.cardDate}>Due: {new Date(due_date).toLocaleDateString()}</Text>
            {contact?.name && <Text style={styles.cardContact}>Contact: {contact.name}</Text>}
            {reminder_type && (
                <View style={styles.tagContainer}>
                    <Text style={styles.tag}>{reminder_type}</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    if (!user) {
        return (
            <View style={styles.container}>
                <Text style={styles.message}>Please log in to view your reminders</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar style="auto" />

            <View style={styles.header}>
                <Text style={styles.title}>Welcome Back!</Text>
                <Text style={styles.subtitle}>You have {reminders.length} upcoming reminders</Text>
            </View>

            <View style={styles.quickActions}>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => Alert.alert('Coming Soon', 'This feature is under development')}
                >
                    <MessageCircle size={24} color="#007AFF" />
                    <Text style={styles.actionText}>New Message</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => Alert.alert('Coming Soon', 'This feature is under development')}
                >
                    <Clock size={24} color="#007AFF" />
                    <Text style={styles.actionText}>Set Reminder</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.remindersList}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {loading ? (
                    <Text style={styles.message}>Loading reminders...</Text>
                ) : reminders.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.message}>No upcoming reminders</Text>
                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={() => Alert.alert('Coming Soon', 'This feature is under development')}
                        >
                            <Plus size={20} color="#007AFF" />
                            <Text style={styles.addButtonText}>Add Reminder</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    reminders.map((reminder) => <ReminderCard key={reminder.id} {...reminder} />)
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        padding: 20,
        backgroundColor: '#f8f9fa',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginTop: 5,
    },
    quickActions: {
        flexDirection: 'row',
        padding: 15,
        justifyContent: 'space-around',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    actionButton: {
        alignItems: 'center',
        padding: 10,
    },
    actionText: {
        marginTop: 5,
        color: '#007AFF',
    },
    remindersList: {
        flex: 1,
        padding: 15,
    },
    card: {
        backgroundColor: '#f8f9fa',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#eee',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '500',
        marginLeft: 10,
        flex: 1,
    },
    cardDescription: {
        color: '#666',
        marginLeft: 30,
        marginBottom: 5,
    },
    cardDate: {
        color: '#666',
        marginLeft: 30,
    },
    cardContact: {
        color: '#666',
        marginLeft: 30,
        marginTop: 5,
    },
    message: {
        textAlign: 'center',
        padding: 20,
        color: '#666',
    },
    emptyState: {
        alignItems: 'center',
        padding: 20,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#007AFF',
        marginTop: 10,
    },
    addButtonText: {
        color: '#007AFF',
        marginLeft: 5,
    },
    tagContainer: {
        marginLeft: 30,
        marginTop: 5,
    },
    tag: {
        color: '#007AFF',
        fontSize: 12,
        backgroundColor: '#e8f2ff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
});