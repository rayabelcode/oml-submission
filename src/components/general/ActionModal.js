import React from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, Text, ActivityIndicator } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';

const ActionModal = ({ show, onClose, options, loading, error }) => {
    const { colors, spacing, layout } = useTheme();

    const styles = StyleSheet.create({
        modalOverlay: {
            flex: 1,
            backgroundColor: colors.background.overlay,
            justifyContent: 'center',
            alignItems: 'center',
        },
        modalContent: {
            width: '80%',
            borderRadius: layout.borderRadius.lg,
            padding: spacing.md,
            backgroundColor: colors.background.secondary,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
        },
        option: {
            padding: spacing.md,
            alignItems: 'center',
        },
        iconContainer: {
            marginBottom: spacing.sm,
        },
        optionText: {
            fontSize: 16,
            fontWeight: '500',
            color: colors.text.primary,
        },
        divider: {
            height: 1,
            width: '100%',
            backgroundColor: colors.border,
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
                            <React.Fragment key={option.id}>
                                <TouchableOpacity
                                    style={styles.option}
                                    onPress={option.onPress}
                                    disabled={option.disabled}
                                >
                                    <View style={styles.iconContainer}>
                                        <Icon
                                            name={option.icon}
                                            size={40}
                                            color={option.disabled ? colors.text.disabled : colors.primary}
                                        />
                                    </View>
                                    <Text
                                        style={[
                                            styles.optionText,
                                            { color: option.disabled ? colors.text.disabled : colors.text.primary },
                                        ]}
                                    >
                                        {option.text}
                                    </Text>
                                </TouchableOpacity>
                                {index < options.length - 1 && <View style={styles.divider} />}
                            </React.Fragment>
                        ))
                    )}
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

export default ActionModal;
