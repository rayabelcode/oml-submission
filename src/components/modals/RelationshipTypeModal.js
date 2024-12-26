import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useCommonStyles } from '../../styles/common';
import SegmentedControlTab from 'react-native-segmented-control-tab';
import Icon from 'react-native-vector-icons/Ionicons';

const RelationshipTypeModal = ({ visible, onClose, onSelect }) => {
	const { colors } = useTheme();
	const commonStyles = useCommonStyles();
	const [selectedIndex, setSelectedIndex] = React.useState(0);
	const relationshipTypes = ['Friend', 'Family', 'Personal', 'Work'];

	const handleConfirm = () => {
		onSelect(relationshipTypes[selectedIndex].toLowerCase());
		onClose();
	};

	return (
		<Modal visible={visible} transparent={true} animationType="fade">
			<View style={commonStyles.modalContainer}>
				<View style={[commonStyles.modalContent, { height: 'auto' }]}>
					<View style={commonStyles.modalHeader}>
						<Text style={commonStyles.modalTitle}>Select Relationship Type</Text>
						<TouchableOpacity onPress={onClose}>
							<Icon name="close-outline" size={24} color={colors.text.secondary} />
						</TouchableOpacity>
					</View>

					<View style={commonStyles.section}>
						<Text style={commonStyles.message}>
							How would you categorize your relationship with this contact?
						</Text>

						<SegmentedControlTab
							values={relationshipTypes}
							selectedIndex={selectedIndex}
							onTabPress={setSelectedIndex}
							tabStyle={{
								borderColor: colors.primary,
								height: 45,
								backgroundColor: 'transparent',
							}}
							tabTextStyle={{
								color: colors.primary,
								fontSize: 16,
							}}
							activeTabStyle={{
								backgroundColor: colors.primary,
							}}
							activeTabTextStyle={{
								color: colors.background.primary,
							}}
						/>
					</View>

					<TouchableOpacity style={commonStyles.primaryButton} onPress={handleConfirm}>
						<Text style={commonStyles.primaryButtonText}>Confirm</Text>
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	);
};

export default RelationshipTypeModal;
