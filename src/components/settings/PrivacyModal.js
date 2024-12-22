import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { useCommonStyles } from '../../styles/common';
import { useStyles } from '../../styles/screens/settings';

const PrivacyModal = ({ visible, onClose, onExportData, onDeleteAccount }) => {
	const { colors } = useTheme();
	const commonStyles = useCommonStyles();
	const styles = useStyles();

	return (
		<Modal visible={visible} animationType="fade" transparent={true}>
			<View style={commonStyles.modalContainer}>
				<View style={commonStyles.modalContent}>
					<View style={commonStyles.modalHeader}>
						<Text style={commonStyles.modalTitle}>Privacy Settings</Text>
						<TouchableOpacity onPress={onClose}>
							<Icon name="close-outline" size={24} color={colors.text.secondary} />
						</TouchableOpacity>
					</View>

					<TouchableOpacity style={styles.privacyOption} onPress={onExportData}>
						<Icon name="download-outline" size={24} color={colors.primary} />
						<Text style={styles.privacyOptionText}>Export My Data</Text>
					</TouchableOpacity>

					<TouchableOpacity style={[styles.privacyOption, styles.deleteOption]} onPress={onDeleteAccount}>
						<Icon name="trash-outline" size={24} color={colors.danger} />
						<Text style={[styles.privacyOptionText, styles.deleteText]}>Delete Account</Text>
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	);
};

export default PrivacyModal;
