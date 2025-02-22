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

	const styles = StyleSheet.create({
		modalOverlay: {
			flex: 1,
			justifyContent: 'center',
			alignItems: 'center',
		},
		modalContent: {
			width: '85%',
			maxWidth: 340,
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
	});

	if (!show) return null;

	if (!modalVisible) return null;

	return (
		<Modal visible={modalVisible} transparent={true} animationType="none" onRequestClose={handleClose}>
			<Animated.View
				style={[
					styles.modalOverlay,
					{
						backgroundColor: colors.background.overlay,
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
							<View style={{ alignItems: 'center' }}>
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
							<View style={styles.optionsContainer}>
								{options.map((option) => (
									<TouchableOpacity
										key={option.id}
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
														option.textColor || (option.id === 'skip' ? colors.danger : colors.text.primary),
												},
											]}
										>
											{option.text}
										</Text>
									</TouchableOpacity>
								))}
							</View>
						)}
					</Animated.View>
				</TouchableOpacity>
			</Animated.View>
		</Modal>
	);
};

export default ActionModal;
