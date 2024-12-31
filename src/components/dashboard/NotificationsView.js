import React from 'react';
import { View, FlatList, Text } from 'react-native';
import { FollowUpNotification } from '../../utils/FollowUpNotification';
import { useStyles } from '../../styles/screens/dashboard';

export const NotificationsView = ({ reminders, onComplete }) => {
    const styles = useStyles();

    return (
        <View style={styles.contactsList}>
            <FlatList
                data={reminders}
                keyExtractor={(item) => item.firestoreId}
                renderItem={({ item }) => <FollowUpNotification reminder={item} onComplete={onComplete} />}
                ListEmptyComponent={() => (
                    <Text style={styles.message}>No follow-up reminders</Text>
                )}
            />
        </View>
    );
};
