import React, { useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useCommonStyles } from '../../styles/common';
import SegmentedControlTab from 'react-native-segmented-control-tab';
import { spacing } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';

const RelationshipTypeModal = ({ visible, onClose, onSelect }) => {
	const { colors } = useTheme();
	const commonStyles = useCommonStyles();
	const [selectedIndex, setSelectedIndex] = React.useState(0);
	const relationshipTypes = ['Friend', 'Family', 'Personal', 'Work'];

	useEffect(() => {
		if (visible) {
			setSelectedIndex(0);
		}
	}, [visible]);

	const handleConfirm = () => {
		onSelect(relationshipTypes[selectedIndex].toLowerCase());
		onClose();
	};

	const handleDismiss = () => {
		Alert.alert(
			'Cancel contact import?',
			'',
			[
				{
					text: 'No',
					style: 'cancel',
				},
				{
					text: 'Yes',
					onPress: onClose,
				},
			],
			{ cancelable: false }
		);
	};

	return (
		<Modal visible={visible} transparent={true} animationType="fade">
			<View style={commonStyles.modalContainer}>
				<View style={[commonStyles.modalContent, { height: 'auto', paddingHorizontal: spacing.lg }]}>
					<Text
						style={[commonStyles.modalTitle, { fontSize: 22, adjustsFontSizeToFit: true, numberOfLines: 1 }]}
					>
						Tag the Relationship!
					</Text>
					<Text
						style={[
							commonStyles.message,
							{ color: colors.text.primary, marginTop: spacing.sm, marginBottom: spacing.md },
						]}
					>
						How do you know this person?{'\n'}You can edit this at any time.
					</Text>
					<View style={{ marginBottom: spacing.xl }}>
						<SegmentedControlTab
							values={relationshipTypes}
							selectedIndex={selectedIndex}
							defaultIndex={0}
							onTabPress={setSelectedIndex}
							tabsContainerStyle={{
								backgroundColor: 'transparent',
							}}
							tabStyle={{
								borderColor: colors.primary,
								backgroundColor: colors.background.primary,
								borderWidth: 1,
								height: 45,
								margin: 0,
							}}
							tabTextStyle={{
								color: colors.text.primary,
								fontSize: 16,
								fontWeight: '600',
							}}
							activeTabStyle={{
								backgroundColor: colors.primary,
							}}
							activeTabTextStyle={{
								color: '#FFFFFF',
								fontWeight: '600',
							}}
						/>
					</View>
					<View style={{ alignItems: 'center' }}>
						<TouchableOpacity
							style={[
								commonStyles.primaryButton,
								{
									paddingHorizontal: spacing.xl,
									backgroundColor: colors.primary,
									minWidth: 120,
								},
							]}
							onPress={handleConfirm}
						>
							<Text
								style={[
									commonStyles.primaryButtonText,
									{
										fontWeight: '700',
										color: '#FFFFFF',
									},
								]}
							>
								Confirm
							</Text>
						</TouchableOpacity>
					</View>
				</View>
				<TouchableOpacity
					onPress={handleDismiss}
					style={{
						marginTop: spacing.xl,
						width: 50,
						height: 50,
						borderRadius: 40,
						backgroundColor: colors.background.secondary,
						justifyContent: 'center',
						alignItems: 'center',
						borderWidth: 1,
						borderColor: colors.border,
					}}
				>
					<Icon name="close" size={24} color={colors.text.primary} />
				</TouchableOpacity>
			</View>
		</Modal>
	);
};

export default RelationshipTypeModal;
