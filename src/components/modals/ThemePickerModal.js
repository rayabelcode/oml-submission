import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';

const ThemePickerModal = ({ visible, onClose }) => {
	const { colors, theme, setThemeValue, spacing, layout } = useTheme();

	const themeOptions = [
		{ value: 'dark', label: 'Dark', icon: 'moon' },
		{ value: 'dimmed', label: 'Dimmed', icon: 'contrast' },
		{ value: 'light', label: 'Light', icon: 'sunny' },
		{ value: 'system', label: 'Match System', icon: 'phone-portrait' },
	];

	const handleThemeChange = (newTheme) => {
		setThemeValue(newTheme);
	};

	const styles = StyleSheet.create({
		modalOverlay: {
			flex: 1,
			justifyContent: 'flex-end',
		},
		modalContent: {
			backgroundColor: colors.background.secondary,
			borderTopLeftRadius: layout.borderRadius.lg,
			borderTopRightRadius: layout.borderRadius.lg,
			paddingBottom: spacing.xxxl,
			borderTopWidth: 2,
			borderTopColor: colors.background.primary,
		},
		handleContainer: {
			alignItems: 'center',
			paddingTop: spacing.sm,
		},
		handle: {
			width: 36,
			height: 5,
			borderRadius: 3,
			backgroundColor: colors.background.tertiary,
		},
		header: {
			flexDirection: 'row',
			justifyContent: 'center',
			alignItems: 'center',
			paddingVertical: spacing.xs,
			paddingHorizontal: spacing.sm,
			paddingBottom: spacing.sm,
			borderBottomWidth: 0.5,
			borderBottomColor: colors.border,
			marginBottom: spacing.sm,
		},
		headerContent: {
			flex: 1,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
		},
		title: {
			fontSize: 22,
			fontWeight: '600',
			color: colors.text.primary,
			textAlign: 'center',
		},
		closeButton: {
			padding: spacing.sm,
		},
		option: {
			flexDirection: 'row',
			alignItems: 'center',
			padding: spacing.md,
			paddingHorizontal: spacing.lg,
			marginLeft: spacing.xs,
			backgroundColor: colors.background.secondary,
		},
		optionText: {
			fontSize: 20,
			color: colors.text.primary,
			marginLeft: spacing.md,
			fontWeight: '600',
			opacity: 0.8,
		},
		selectedOption: {},
		checkmark: {
			marginLeft: 'auto',
			color: colors.buttons.activeIcon,
		},
		themeIcon: {
			width: 24,
			alignItems: 'center',
		},
	});

	return (
		<Modal visible={visible} transparent onRequestClose={onClose} animationType="slide">
			<TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
				<TouchableOpacity style={styles.modalContent} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
					<View style={styles.handleContainer}>
						<View style={styles.handle} />
					</View>
					<View style={styles.header}>
						<View style={styles.headerContent}>
							<View style={{ width: 28 }} />
							<Text style={styles.title}>Choose Theme</Text>
							<TouchableOpacity onPress={onClose} style={styles.closeButton}>
								<Icon name="close" size={28} color={colors.action} />
							</TouchableOpacity>
						</View>
					</View>
					{themeOptions.map((option) => (
						<TouchableOpacity
							key={option.value}
							style={[styles.option, theme === option.value && styles.selectedOption]}
							onPress={() => handleThemeChange(option.value)}
						>
							<View style={styles.themeIcon}>
								<Icon name={option.icon} size={20} color={colors.text.secondary} />
							</View>
							<Text style={styles.optionText}>{option.label}</Text>
							{theme === option.value && <Icon name="checkmark" size={26} style={styles.checkmark} />}
						</TouchableOpacity>
					))}
				</TouchableOpacity>
			</TouchableOpacity>
		</Modal>
	);
};

export default ThemePickerModal;
