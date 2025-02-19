import React from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, Text, ActivityIndicator } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';

const ActionModal = ({ show, onClose, options, loading, error, title }) => {
    const { colors, spacing, layout } = useTheme();

    const styles = StyleSheet.create({
        modalOverlay: {
            flex: 1,
            backgroundColor: colors.background.overlay,
            justifyContent: 'center',
            alignItems: 'center',
        },
        modalContent: {
            width: '85%',
            maxWidth: 340,
            borderRadius: layout.borderRadius.lg,
            backgroundColor: colors.background.secondary,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
            overflow: 'hidden',
        },
        modalHeader: {
            padding: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            alignItems: 'center',
        },
        headerText: {
            fontSize: 19,
            fontWeight: '600',
            color: colors.text.primary,
            opacity: 0.75,
        },
        option: {
            paddingVertical: spacing.xl,
            paddingHorizontal: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        optionContent: {
            width: '70%',
            flexDirection: 'row',
            alignItems: 'center',
        },
        iconContainer: {
            width: 40,
            alignItems: 'center',
            marginRight: spacing.md,
        },
        optionText: {
            fontSize: 20,
            fontWeight: '600',
            flex: 1,
        },
        loadingContainer: {
            padding: spacing.xl,
            alignItems: 'center',
        },
        loadingText: {
            marginTop: spacing.md,
            fontSize: 16,
            fontWeight: '500',
            color: colors.text.primary,
        },
        errorContainer: {
            padding: spacing.xl,
            alignItems: 'center',
        },
        errorText: {
            marginTop: spacing.md,
            fontSize: 16,
            fontWeight: '500',
            color: colors.danger,
            textAlign: 'center',
        },
        retryButton: {
            marginTop: spacing.lg,
            padding: spacing.md,
        },
        retryText: {
            fontSize: 16,
            fontWeight: '500',
            color: colors.primary,
        },
    });

    if (!show) return null;

    return (
        <Modal visible={show} transparent={true} animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={loading ? null : onClose}>
                <View style={styles.modalContent}>
                    {title && (
                        <View style={styles.modalHeader}>
                            <Text style={styles.headerText}>{title}</Text>
                        </View>
                    )}
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={styles.loadingText}>Processing...</Text>
                        </View>
                    ) : error ? (
                        <View style={styles.errorContainer}>
                            <Icon name="alert-circle" size={40} color={colors.danger} />
                            <Text style={styles.errorText}>{error}</Text>
                            <TouchableOpacity style={styles.retryButton} onPress={onClose}>
                                <Text style={styles.retryText}>Try Again</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        options.map((option, index) => (
                            <TouchableOpacity
                                key={option.id}
                                style={[styles.option, index === options.length - 1 && { borderBottomWidth: 0 }]}
                                onPress={option.onPress}
                                disabled={option.disabled}
                            >
                                <View style={styles.optionContent}>
                                    <View style={styles.iconContainer}>
                                        <Icon
                                            name={option.icon}
                                            size={32}
                                            color={
                                                option.disabled
                                                    ? colors.text.disabled
                                                    : option.id === 'skip'
                                                    ? colors.danger
                                                    : colors.primary
                                            }
                                        />
                                    </View>
                                    <Text
                                        style={[
                                            styles.optionText,
                                            {
                                                color: option.disabled
                                                    ? colors.text.disabled
                                                    : option.id === 'skip'
                                                    ? colors.danger
                                                    : colors.text.primary,
                                            },
                                        ]}
                                    >
                                        {option.text}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

export default ActionModal;
