import React from 'react';
import { View, StyleSheet } from 'react-native';
import SegmentedControlTab from 'react-native-segmented-control-tab';
import { useTheme } from '../../context/ThemeContext';
import { SCHEDULING_CONSTANTS } from '../../utils/contactHelpers';

const RelationshipTypeSelector = ({ selectedIndex, onSelectionChange }) => {
    const { colors } = useTheme();
    // Use the constants and capitalize first letter for display
    const relationshipTypes = SCHEDULING_CONSTANTS.RELATIONSHIP_TYPES.map(
        type => type.charAt(0).toUpperCase() + type.slice(1)
    );

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
                onTabPress={(index) => {
                    // Convert back to lowercase when sending the selection
                    onSelectionChange(SCHEDULING_CONSTANTS.RELATIONSHIP_TYPES[index]);
                }}
                tabStyle={styles.tabStyle}
                tabTextStyle={styles.tabTextStyle}
                activeTabStyle={styles.activeTabStyle}
                activeTabTextStyle={styles.activeTabTextStyle}
            />
        </View>
    );
};

export default RelationshipTypeSelector;
