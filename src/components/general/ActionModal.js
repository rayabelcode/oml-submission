import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, Text, ActivityIndicator, Animated } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';

const ActionModal = ({
	show = false,
	onClose = () => {},
	options = [],
	loading = false,
	error = null,
	title = '',
	statusMessage = null,
	statusIndicator = null,
	frequencyMessage = null,
}) => {
	const { colors, spacing, layout } = useTheme();
	const [modalVisible, setModalVisible] = useState(show);
	const scaleAnim = useRef(new Animated.Value(0.9)).current;
	const opacityAnim = useRef(new Animated.Value(0)).current;
	const overlayAnim = useRef(new Animated.Value(0)).current;

	const fadeOut = () => {
		return new Promise((resolve) => {
			Animated.parallel([
				Animated.timing(overlayAnim, {
					toValue: 0,
					duration: 200,
					useNativeDriver: true,
				}),
				Animated.timing(opacityAnim, {
					toValue: 0,
					duration: 200,
					useNativeDriver: true,
				}),
				Animated.timing(scaleAnim, {
					toValue: 0.9,
					duration: 200,
					useNativeDriver: true,
				}),
			]).start(() => resolve());
		});
	};

	const handleClose = async () => {
		if (loading) return;
		await fadeOut();
		setModalVisible(false);
		onClose();
	};

	useEffect(() => {
		if (show) {
			setModalVisible(true);
			Animated.parallel([
				Animated.spring(scaleAnim, {
					toValue: 1,
					useNativeDriver: true,
					tension: 50,
					friction: 7,
				}),
				Animated.timing(opacityAnim, {
					toValue: 1,
					duration: 200,
					useNativeDriver: true,
				}),
				Animated.timing(overlayAnim, {
					toValue: 1,
					duration: 200,
					useNativeDriver: true,
				}),
			]).start();
		}
	}, [show]);

	const getStatusColor = () => {
		if (!statusIndicator) return colors.text.primary;

		switch (statusIndicator) {
			case 'warning':
				return colors.warning || '#FFA500';
			case 'critical':
				return colors.danger;
			default:
				return colors.text.primary;
		}
	};

	const styles = StyleSheet.create({
		modalOverlay: {
			flex: 1,
			justifyContent: 'center',
			alignItems: 'center',
			backgroundColor: colors.background.overlay,
		},
		modalContent: {
			width: '85%',
			maxWidth: 340,
			// backgroundColor: colors.background.secondary,
			borderRadius: layout.borderRadius.lg,
			shadowColor: '#000',
			shadowOffset: { width: 0, height: 2 },
			shadowOpacity: 0.25,
			shadowRadius: 3.84,
			elevation: 5,
			overflow: 'hidden',
		},
		modalHeader: {
			alignItems: 'center',
			paddingVertical: spacing.sm,
			paddingHorizontal: spacing.xl,
			backgroundColor: colors.background.whiteText,
			borderRadius: layout.borderRadius.lg,
			alignSelf: 'center',
			marginBottom: spacing.xxs,
		},
		headerText: {
			fontSize: 22,
			fontWeight: '700',
			color: colors.text.white,
		},
		optionsContainer: {
			padding: spacing.md,
		},
		button: {
			backgroundColor: colors.background.tertiary,
			borderRadius: layout.borderRadius.lg,
			marginVertical: spacing.sm,
			padding: spacing.lg,
			flexDirection: 'row',
			alignItems: 'center',
		},
		iconContainer: {
			position: 'absolute',
			left: spacing.lg,
			alignItems: 'center',
			justifyContent: 'center',
		},
		buttonText: {
			fontSize: 22,
			fontWeight: '700',
			flex: 1,
			textAlign: 'center',
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
		// Box for status message
		statusContainer: {
			padding: spacing.md,
			marginHorizontal: spacing.sm,
			marginTop: spacing.lg,
			borderRadius: layout.borderRadius.lg,
			alignItems: 'center',
			backgroundColor: colors.background.whiteText,
		},
		// Status message (e.g. "Maximum Snoozes Reached")
		statusText: {
			fontSize: 17,
			fontWeight: '700',
			textAlign: 'center',
		},
		// Text below status message
		frequencyText: {
			fontSize: 16,
			lineHeight: 19,
			fontWeight: '500',
			fontStyle: 'italic',
			color: colors.text.secondary,
			textAlign: 'center',
			marginTop: statusMessage ? spacing.xs : 0,
		},
	});

	if (!show) return null;
	if (!modalVisible) return null;

	return (
		<Modal visible={modalVisible} transparent={true} animationType="none" onRequestClose={handleClose}>
			<Animated.View
				style={[
					styles.modalOverlay,
					{
						opacity: overlayAnim,
					},
				]}
			>
				<TouchableOpacity
					style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}
					activeOpacity={1}
					onPress={handleClose}
				>
					<Animated.View
						style={[
							styles.modalContent,
							{
								opacity: opacityAnim,
								transform: [{ scale: scaleAnim }],
							},
						]}
					>
						{title && (
							<View style={{ alignItems: 'center', paddingTop: spacing.md }}>
								<View style={styles.modalHeader}>
									<Text style={styles.headerText}>{title}</Text>
								</View>
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
								<TouchableOpacity style={styles.retryButton} onPress={handleClose}>
									<Text style={styles.retryText}>Try Again</Text>
								</TouchableOpacity>
							</View>
						) : (
							<>
								{/* Action options */}
								<View style={styles.optionsContainer}>
									{options.map((option) => (
										<TouchableOpacity
											key={option.id || Math.random().toString()}
											style={[styles.button, option.disabled && { opacity: 0.5 }]}
											onPress={option.onPress}
											disabled={option.disabled}
										>
											<View style={styles.iconContainer}>
												<Icon
													name={option.icon}
													size={28}
													color={option.iconColor || (option.id === 'skip' ? colors.danger : colors.primary)}
												/>
											</View>
											<Text
												style={[
													styles.buttonText,
													{
														color:
															option.textColor ||
															(option.id === 'skip' ? colors.danger : colors.text.primary),
													},
												]}
											>
												{option.text}
											</Text>
										</TouchableOpacity>
									))}
								</View>
							</>
						)}

						{/* Combined Status and Frequency message display */}
						{(statusMessage || frequencyMessage) && (
							<View
								style={[
									styles.statusContainer,
									statusIndicator === 'warning' && {
										borderColor: colors.warning || '#FFA500',
										borderWidth: 1,
									},
									statusIndicator === 'critical' && {
										borderColor: colors.danger,
										borderWidth: 0.3,
									},
								]}
							>
								{statusMessage && (
									<Text style={[styles.statusText, { color: getStatusColor() }]}>{statusMessage}</Text>
								)}
								{frequencyMessage && <Text style={styles.frequencyText}>{frequencyMessage}</Text>}
							</View>
						)}
					</Animated.View>
				</TouchableOpacity>
			</Animated.View>
		</Modal>
	);
};

export default ActionModal;
