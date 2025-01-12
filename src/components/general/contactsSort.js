import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
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
        modalContent: {
            backgroundColor: colors.background.primary,
            borderRadius: 20,
            padding: 20,
            width: '85%',
            maxHeight: windowHeight * 0.35,
        },
        section: {
            marginBottom: 15,
        },
        sectionTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text.primary,
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
            right: -10,
            top: -10,
            padding: 10,
        },
    });

    return (
        <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Display Options</Text>
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.closeButton}
                        >
                            <Icon name="close" size={24} color={colors.text.primary} />
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
                        />
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Group By</Text>
                        <SegmentedControl
                            values={['Schedule', 'Relationship', 'None']}
                            selectedIndex={
                                groupBy === 'schedule' ? 0 : groupBy === 'relationship' ? 1 : 2
                            }
                            onChange={(event) => {
                                const values = ['schedule', 'relationship', 'none'];
                                onGroupByChange(values[event.nativeEvent.selectedSegmentIndex]);
                            }}
                            style={styles.segmentedControl}
                        />
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Name Display</Text>
                        <SegmentedControl
                            values={['Full Name', 'First Only', 'Initials']}
                            selectedIndex={
                                nameDisplay === 'full' ? 0 : nameDisplay === 'firstOnly' ? 1 : 2
                            }
                            onChange={(event) => {
                                const values = ['full', 'firstOnly', 'initials'];
                                onNameDisplayChange(values[event.nativeEvent.selectedSegmentIndex]);
                            }}
                            style={styles.segmentedControl}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default ContactsSortMenu;
