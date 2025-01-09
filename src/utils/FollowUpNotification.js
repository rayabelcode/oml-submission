import React, { useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { completeFollowUp } from './firestore';

export const FollowUpNotification = ({ reminder, onComplete }) => {
	const [notes, setNotes] = useState('');

	const handleComplete = async () => {
		try {
			await completeFollowUp(reminder.id, notes);
			onComplete && onComplete(reminder.id);
		} catch (error) {
			console.error('Error completing follow-up:', error);
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Add Call Notes</Text>
			<Text style={styles.subtitle}>
				{`Call with ${reminder.contact_name || 'Contact'}`}
				{reminder.call_duration ? ` (${Math.round(reminder.call_duration / 60)} minutes)` : ''}
			</Text>

			<TextInput
				style={styles.input}
				multiline
				placeholder="Add notes about your call..."
				value={notes}
				onChangeText={setNotes}
			/>

			<View style={styles.buttonContainer}>
				<TouchableOpacity style={[styles.button, styles.skipButton]} onPress={() => handleComplete()}>
					<Text style={styles.buttonText}>Skip</Text>
				</TouchableOpacity>

				<TouchableOpacity style={[styles.button, styles.saveButton]} onPress={() => handleComplete()}>
					<Text style={styles.buttonText}>Save Notes</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		padding: 16,
		backgroundColor: '#fff',
		borderRadius: 8,
		elevation: 3,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
	},
	title: {
		fontSize: 18,
		fontWeight: 'bold',
		marginBottom: 8,
	},
	subtitle: {
		fontSize: 14,
		color: '#666',
		marginBottom: 16,
	},
	input: {
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 4,
		padding: 8,
		minHeight: 100,
		marginBottom: 16,
	},
	buttonContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	button: {
		flex: 1,
		padding: 12,
		borderRadius: 4,
		marginHorizontal: 4,
	},
	skipButton: {
		backgroundColor: '#gray',
	},
	saveButton: {
		backgroundColor: '#007AFF',
	},
	buttonText: {
		color: '#fff',
		textAlign: 'center',
		fontWeight: 'bold',
	},
});
