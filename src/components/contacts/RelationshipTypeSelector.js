import React from 'react';
import { View, StyleSheet } from 'react-native';
import SegmentedControlTab from 'react-native-segmented-control-tab';
import { useTheme } from '../../context/ThemeContext';

const RelationshipTypeSelector = ({ selectedIndex, onSelectionChange }) => {
	const { colors } = useTheme();
	const relationshipTypes = ['Friend', 'Family', 'Personal', 'Work'];

	const styles = StyleSheet.create({
		container: {
			padding: 15,
		},
		tabStyle: {
			borderColor: colors.primary,
			height: 45,
			backgroundColor: 'transparent',
		},
		tabTextStyle: {
			color: colors.primary,
			fontSize: 14,
		},
		activeTabStyle: {
			backgroundColor: colors.primary,
		},
		activeTabTextStyle: {
			color: colors.background.primary,
		},
	});

	return (
		<View style={styles.container}>
			<SegmentedControlTab
				values={relationshipTypes}
				selectedIndex={selectedIndex}
				onTabPress={onSelectionChange}
				tabStyle={styles.tabStyle}
				tabTextStyle={styles.tabTextStyle}
				activeTabStyle={styles.activeTabStyle}
				activeTabTextStyle={styles.activeTabTextStyle}
			/>
		</View>
	);
};

export default RelationshipTypeSelector;
