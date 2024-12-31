import React, { useState, useEffect } from 'react';
import { Text, View, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useStyles } from '../styles/screens/dashboard';
import { useCommonStyles } from '../styles/common';
import { useTheme } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { fetchUpcomingContacts } from '../utils/firestore';
import { NotificationsView } from '../components/dashboard/NotificationsView';
import { notificationService } from '../utils/notifications';
import ContactCard from '../components/dashboard/ContactCard';

export default function DashboardScreen({ navigation }) {
    const { user } = useAuth();
    const { colors } = useTheme();
    const styles = useStyles();
    const commonStyles = useCommonStyles();
    const [contacts, setContacts] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('calendar');
    const [remindersState, setRemindersState] = useState({
        data: [],
        loading: true,
        error: null,
    });

    const loadReminders = async () => {
        setRemindersState((prev) => ({ ...prev, loading: true, error: null }));
        try {
            const activeReminders = await notificationService.getActiveReminders();
            setRemindersState({
                data: activeReminders,
                loading: false,
                error: null,
            });
        } catch (error) {
            setRemindersState({
                data: [],
                loading: false,
                error: 'Failed to load reminders',
            });
            Alert.alert('Error', 'Failed to load reminders');
        }
    };

    const handleFollowUpComplete = async (reminderId, notes) => {
        try {
            await notificationService.handleFollowUpComplete(reminderId, notes);
            loadReminders();
        } catch (error) {
            Alert.alert('Error', 'Failed to complete follow-up');
        }
    };

    async function loadContacts() {
        try {
            if (!user) return;
            const contactsList = await fetchUpcomingContacts(user.uid);
            setContacts(contactsList.sort((a, b) => new Date(a.next_contact) - new Date(b.next_contact)));
        } catch (error) {
            Alert.alert('Error', 'Failed to load contacts');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (user) {
            loadContacts();
            loadReminders();
        }
    }, [user]);

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        try {
            await Promise.all([loadContacts(), loadReminders()]);
        } catch (error) {
            Alert.alert('Error', 'Failed to refresh data');
        } finally {
            setRefreshing(false);
        }
    }, []);

    if (!user) {
        return (
            <View style={commonStyles.container}>
                <Text style={commonStyles.message}>Please log in to view your calendar</Text>
            </View>
        );
    }

    return (
        <View style={commonStyles.container}>
            <StatusBar style="auto" />
            <View style={styles.header}>
                <Text style={styles.title}>Calendar</Text>
            </View>

            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={[commonStyles.toggleButton, viewMode === 'calendar' && styles.toggleButtonActive]}
                    onPress={() => setViewMode('calendar')}
                >
                    <Icon name="calendar-clear-outline" size={24} color={colors.primary} />
                    <Text style={styles.toggleButtonText}>Upcoming</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[commonStyles.toggleButton, viewMode === 'notifications' && styles.toggleButtonActive]}
                    onPress={() => setViewMode('notifications')}
                >
                    <Icon name="notifications-outline" size={24} color={colors.primary} />
                    <Text style={styles.toggleButtonText}>Notifications</Text>
                </TouchableOpacity>
            </View>

            {viewMode === 'calendar' ? (
                <ScrollView
                    style={styles.contactsList}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                    {loading ? (
                        <Text style={commonStyles.message}>Loading contacts...</Text>
                    ) : contacts.length === 0 ? (
                        <Text style={commonStyles.message}>No upcoming contacts</Text>
                    ) : (
                        contacts.map((contact) => <ContactCard key={contact.id} contact={contact} onPress={() => {}} />)
                    )}
                </ScrollView>
            ) : (
                <NotificationsView
                    reminders={remindersState.data}
                    onComplete={handleFollowUpComplete}
                    loading={remindersState.loading}
                    onRefresh={onRefresh}
                    refreshing={refreshing}
                />
            )}
        </View>
    );
}
