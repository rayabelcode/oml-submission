import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useCommonStyles } from '../../styles/common';
import Icon from 'react-native-vector-icons/Ionicons';
import { RELATIONSHIP_TYPES } from '../../../constants/relationships';

const MenuOption = ({ label, selected, onPress, icon }) => {
	const { colors } = useTheme();
	return (
		<TouchableOpacity
			onPress={onPress}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				padding: 15,
				backgroundColor: selected ? colors.background.secondary : 'transparent',
				borderRadius: 8,
			}}
		>
			{icon && (
				<Icon
					name={icon}
					size={24}
					color={selected ? colors.primary : colors.text.primary}
					style={{ marginRight: 10 }}
				/>
			)}
			<Text
				style={{
					color: selected ? colors.primary : colors.text.primary,
					fontWeight: selected ? '600' : '400',
					flex: 1,
				}}
			>
				{label}
			</Text>
			{selected && <Icon name="checkmark" size={24} color={colors.primary} />}
		</TouchableOpacity>
	);
};

const SectionHeader = ({ title }) => {
	const { colors } = useTheme();
	return (
		<View style={{ padding: 15, backgroundColor: colors.background.secondary }}>
			<Text style={{ color: colors.text.secondary, fontWeight: '600' }}>{title}</Text>
		</View>
	);
};

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

	return (
		<Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
			<View style={commonStyles.modalContainer}>
				<View style={[commonStyles.modalContent, { height: '70%' }]}>
					<View style={commonStyles.modalHeader}>
						<Text style={commonStyles.modalTitle}>Display Options</Text>
						<TouchableOpacity
							onPress={onClose}
							style={{
								position: 'absolute',
								right: 0,
								padding: 15,
							}}
						>
							<Icon name="close" size={24} color={colors.text.primary} />
						</TouchableOpacity>
					</View>

					<ScrollView>
						<SectionHeader title="Sort By" />
						<MenuOption
							label="First Name"
							selected={sortType === 'firstName'}
							onPress={() => onSortTypeChange('firstName')}
							icon="text"
						/>
						<MenuOption
							label="Last Name"
							selected={sortType === 'lastName'}
							onPress={() => onSortTypeChange('lastName')}
							icon="text"
						/>

						<SectionHeader title="Group By" />
						<MenuOption
							label="Scheduled/Unscheduled"
							selected={groupBy === 'schedule'}
							onPress={() => onGroupByChange('schedule')}
							icon="calendar"
						/>
						<MenuOption
							label="Relationship Type"
							selected={groupBy === 'relationship'}
							onPress={() => onGroupByChange('relationship')}
							icon="people"
						/>
						<MenuOption
							label="None"
							selected={groupBy === 'none'}
							onPress={() => onGroupByChange('none')}
							icon="list"
						/>

						<SectionHeader title="Name Display" />
						<MenuOption
							label="Full Names"
							selected={nameDisplay === 'full'}
							onPress={() => onNameDisplayChange('full')}
							icon="person"
						/>
						<MenuOption
							label="First Name Only"
							selected={nameDisplay === 'firstOnly'}
							onPress={() => onNameDisplayChange('firstOnly')}
							icon="person-outline"
						/>
						<MenuOption
							label="Initials"
							selected={nameDisplay === 'initials'}
							onPress={() => onNameDisplayChange('initials')}
							icon="text"
						/>
					</ScrollView>
				</View>
			</View>
		</Modal>
	);
};

export default ContactsSortMenu;
