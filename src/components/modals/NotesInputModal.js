import React, { useState, useCallback } from 'react';
import {
	Modal,
	View,
	TextInput,
	TouchableOpacity,
	Text,
	TouchableWithoutFeedback,
	Keyboard,
} from 'react-native';
import { useTheme, spacing, layout } from '../../context/ThemeContext';
import { useCommonStyles } from '../../styles/common';
import Icon from 'react-native-vector-icons/Ionicons';

const NotesInputModal = ({ visible, onClose, onSubmit, initialValue = '', contactName = '' }) => {
	const [notes, setNotes] = useState(initialValue);
	const { colors } = useTheme();
	const commonStyles = useCommonStyles();

	const handleSubmit = useCallback(() => {
		if (notes.trim()) {
			onSubmit(notes.trim());
			setNotes('');
		}
	}, [notes, onSubmit]);

	const handleClose = useCallback(() => {
		setNotes('');
		onClose();
	}, [onClose]);

	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
			<TouchableWithoutFeedback onPress={Keyboard.dismiss}>
				<View style={commonStyles.modalContainer}>
					<View style={[commonStyles.modalContent, { height: 'auto', maxHeight: '75%' }]}>
						<View style={commonStyles.modalHeader}>
							<Text style={commonStyles.modalTitle}>Add Notes {contactName ? `for ${contactName}` : ''}</Text>
							<TouchableOpacity
								onPress={handleClose}
								style={{
									position: 'absolute',
									right: 0,
									padding: spacing.sm,
								}}
							>
								<Icon name="close" size={24} color={colors.text.secondary} />
							</TouchableOpacity>
						</View>

						<TextInput
							style={[
								commonStyles.input,
								{
									minHeight: 120,
									maxHeight: 200,
									textAlignVertical: 'top',
									marginVertical: spacing.md,
									backgroundColor: colors.background.tertiary,
								},
							]}
							multiline
							placeholder="Enter your call notes here..."
							placeholderTextColor={colors.text.secondary}
							value={notes}
							onChangeText={setNotes}
							autoFocus
							maxLength={1000}
						/>

						<View
							style={{
								flexDirection: 'row',
								justifyContent: 'flex-end',
								gap: spacing.sm,
								marginTop: spacing.md,
							}}
						>
							<TouchableOpacity style={commonStyles.secondaryButton} onPress={handleClose}>
								<Text style={commonStyles.secondaryButtonText}>Cancel</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[
									commonStyles.primaryButton,
									{
										opacity: notes.trim() ? 1 : 0.5,
									},
								]}
								onPress={handleSubmit}
								disabled={!notes.trim()}
							>
								<Text style={commonStyles.primaryButtonText}>Save Notes</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</TouchableWithoutFeedback>
		</Modal>
	);
};

export default NotesInputModal;
