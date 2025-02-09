import React from 'react';
import { View, Text, Modal, Platform, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, layout, useTheme } from '../../context/ThemeContext';
import { useCommonStyles } from '../../styles/common';
import Icon from 'react-native-vector-icons/Ionicons';
import SegmentedControl from '@react-native-segmented-control/segmented-control';

const ContactsSortMenu = ({
	visible,
	onClose,
	sortType,
	groupBy,
	nameDisplay,
	showProfilePhotos,
	onSortTypeChange,
	onGroupByChange,
	onNameDisplayChange,
	onShowProfilePhotosChange,
}) => {
	const { colors } = useTheme();
	const commonStyles = useCommonStyles();

	const styles = StyleSheet.create({
		modalOverlay: {
			flex: 1,
			backgroundColor: colors.background.overlay,
			justifyContent: 'center',
			alignItems: 'center',
		},
		modalWrapper: {
			width: '85%',
			maxWidth: Platform.isPad ? 500 : undefined,
		},
		displayoptionsContent: {
			backgroundColor: colors.background.primary,
			borderRadius: layout.borderRadius.lg,
			padding: spacing.lg,
			width: '100%',
		},
		section: {
			marginBottom: spacing.md,
		},
		sectionTitle: {
			fontSize: 16,
			fontWeight: '600',
			color: colors.text.secondary,
			marginBottom: spacing.sm,
			textAlign: 'center',
		},
		segmentedControl: {
			height: 40,
			marginBottom: spacing.xs,
		},
		header: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			marginBottom: spacing.md,
			position: 'relative',
		},
		title: {
			fontSize: 18,
			fontWeight: '600',
			color: colors.text.primary,
		},
		closeButton: {
			position: 'absolute',
			right: -spacing.sm,
			top: -spacing.md,
			padding: spacing.md,
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
								fontStyle={{ color: colors.text.primary }}
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
								fontStyle={{ color: colors.text.primary }}
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
								fontStyle={{ color: colors.text.primary }}
								tintColor={colors.primary}
							/>
						</View>

						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Profile Photos</Text>
							<SegmentedControl
								values={['Show', 'Hide']}
								selectedIndex={showProfilePhotos ? 0 : 1}
								onChange={(event) => {
									onShowProfilePhotosChange(event.nativeEvent.selectedSegmentIndex === 0);
								}}
								style={styles.segmentedControl}
								fontStyle={{ color: colors.text.primary }}
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
