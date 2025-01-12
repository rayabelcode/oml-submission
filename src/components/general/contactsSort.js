import React from 'react';
import { View, Text, Modal, Platform, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { spacing, useTheme } from '../../context/ThemeContext';
import { useCommonStyles } from '../../styles/common';
import Icon from 'react-native-vector-icons/Ionicons';
import SegmentedControl from '@react-native-segmented-control/segmented-control';

const ContactsSortMenu = ({
	visible,
	onClose,
	sortType,
	groupBy,
	nameDisplay,
	onSortTypeChange,
	onGroupByChange,
	onNameDisplayChange,
}) => {
	const { colors } = useTheme();
	const commonStyles = useCommonStyles();
	const windowHeight = Dimensions.get('window').height;

	const styles = StyleSheet.create({
		modalOverlay: {
			flex: 1,
			backgroundColor: 'rgba(0, 0, 0, 0.5)',
			justifyContent: 'center',
			alignItems: 'center',
		},
		modalWrapper: {
			width: '85%',
			maxWidth: Platform.isPad ? 500 : undefined,
		},
		displayoptionsContent: {
			backgroundColor: colors.background.primary,
			borderRadius: 20,
			paddingHorizontal: 20,
			paddingVertical: 15,
			width: '100%',
			maxHeight: Platform.isPad ? 600 : undefined,
		},
		section: {
			marginBottom: 15,
		},
		sectionTitle: {
			fontSize: 16,
			fontWeight: '600',
			color: colors.text.secondary,
			marginBottom: 8,
		},
		segmentedControl: {
			height: 40,
			marginBottom: 5,
		},
		header: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			marginBottom: 15,
			position: 'relative',
		},
		title: {
			fontSize: 18,
			fontWeight: '600',
			color: colors.text.primary,
		},
		closeButton: {
			position: 'absolute',
			right: -12,
			top: -15,
			padding: 14,
		},
	});

	return (
		<Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
			<TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
				<TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.modalWrapper}>
					<View style={styles.displayoptionsContent}>
						<View style={styles.header}>
							<Text style={styles.title}>Display Options</Text>
							<TouchableOpacity onPress={onClose} style={styles.closeButton}>
								<Icon name="close" size={30} color={colors.text.primary} />
							</TouchableOpacity>
						</View>

						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Sort By</Text>
							<SegmentedControl
								values={['First Name', 'Last Name']}
								selectedIndex={sortType === 'firstName' ? 0 : 1}
								onChange={(event) => {
									onSortTypeChange(event.nativeEvent.selectedSegmentIndex === 0 ? 'firstName' : 'lastName');
								}}
								style={styles.segmentedControl}
								fontStyle={{ color: colors.text.primary, fontWeight: '600' }}
								tintColor={colors.primary}
							/>
						</View>

						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Group By</Text>
							<SegmentedControl
								values={['Schedule', 'Relationship', 'None']}
								selectedIndex={groupBy === 'schedule' ? 0 : groupBy === 'relationship' ? 1 : 2}
								onChange={(event) => {
									const values = ['schedule', 'relationship', 'none'];
									onGroupByChange(values[event.nativeEvent.selectedSegmentIndex]);
								}}
								style={styles.segmentedControl}
								fontStyle={{ color: colors.text.primary, fontWeight: '600' }}
								tintColor={colors.primary}
							/>
						</View>

						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Name Display</Text>
							<SegmentedControl
								values={['Full Name', 'First Only', 'Initials']}
								selectedIndex={nameDisplay === 'full' ? 0 : nameDisplay === 'firstOnly' ? 1 : 2}
								onChange={(event) => {
									const values = ['full', 'firstOnly', 'initials'];
									onNameDisplayChange(values[event.nativeEvent.selectedSegmentIndex]);
								}}
								style={styles.segmentedControl}
								fontStyle={{ color: colors.text.primary, fontWeight: '600' }}
								tintColor={colors.primary}
							/>
						</View>
					</View>
				</TouchableOpacity>
			</TouchableOpacity>
		</Modal>
	);
};

export default ContactsSortMenu;
