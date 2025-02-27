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
			backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
			fontWeight: '700',
			color: colors.text.primary,
			opacity: 0.8,
			marginBottom: spacing.sm,
			textAlign: 'center',
		},
		segmentedControl: {
			height: 45,
			marginBottom: spacing.xs,
		},
		header: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			marginBottom: spacing.md,
			position: 'relative',
			height: 40,
		},
		title: {
			fontSize: 20,
			fontWeight: '700',
			color: colors.text.primary,
		},
		closeButton: {
			position: 'absolute',
			right: 0,
			alignItems: 'center',
			justifyContent: 'center',
			height: 40,
			width: 40,
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
								<Icon name="close" size={35} color={colors.warning} />
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
								fontStyle={{
									fontSize: 18,
									fontWeight: '800',
									color: colors.text.primary,
								}}
								activeFontStyle={{
									fontSize: 18,
									fontWeight: '800',
									color: colors.text.primary,
								}}
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
								fontStyle={{
									fontSize: 15,
									fontWeight: '800',
									color: colors.text.primary,
								}}
								activeFontStyle={{
									fontSize: 15,
									fontWeight: '800',
									color: colors.text.primary,
								}}
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
								fontStyle={{
									fontSize: 15,
									fontWeight: '800',
									color: colors.text.primary,
								}}
								activeFontStyle={{
									fontSize: 15,
									fontWeight: '800',
									color: colors.text.primary,
								}}
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
								fontStyle={{
									fontSize: 18,
									fontWeight: '800',
									color: colors.text.primary,
								}}
								activeFontStyle={{
									fontSize: 18,
									fontWeight: '800',
									color: colors.text.primary,
								}}
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
