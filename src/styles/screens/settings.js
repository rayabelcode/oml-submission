import { StyleSheet, Platform } from 'react-native';
import { spacing, layout, useTheme } from '../../context/ThemeContext';

const createStyles = (colors) =>
	StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: colors.background.primary,
			paddingTop: Platform.OS === 'ios' ? 50 : 0,
		},
		settingsList: {
			flex: 1,
			backgroundColor: colors.background.primary,
		},
		profileSection: {
			flexDirection: 'row',
			padding: spacing.md,
			backgroundColor: colors.background.secondary,
			alignItems: 'center',
		},
		profileInfo: {
			marginLeft: spacing.md,
			flex: 1,
			justifyContent: 'center',
		},
		profileName: {
			fontSize: 18,
			marginLeft: spacing.md,
			fontWeight: 'bold',
			color: colors.text.primary,
			flexWrap: 'wrap',
			flex: 1,
		},
		profileEmail: {
			color: colors.text.secondary,
		},
		avatar: {
			width: 60,
			height: 60,
			borderRadius: 30,
			backgroundColor: colors.background.secondary,
			justifyContent: 'center',
			alignItems: 'center',
			position: 'relative',
		},
		avatarImage: {
			width: '100%',
			height: '100%',
			borderRadius: 30,
		},
		editOverlay: {
			position: 'absolute',
			bottom: -5,
			right: -5,
			backgroundColor: colors.primary,
			borderRadius: 12,
			padding: 5,
		},
		settingSection: {
			padding: spacing.md,
			borderBottomWidth: 1,
			borderBottomColor: colors.border,
		},
		sectionTitle: {
			fontSize: 16,
			fontWeight: '500',
			marginBottom: spacing.sm,
			color: colors.text.secondary,
		},
		settingItem: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			paddingVertical: spacing.sm,
		},
		settingItemLeft: {
			flexDirection: 'row',
			alignItems: 'center',
		},
		settingText: {
			marginLeft: spacing.md,
			fontSize: 16,
			color: colors.text.primary,
		},
		loginContainer: {
			flex: 1,
			padding: spacing.md,
			justifyContent: 'center',
			backgroundColor: colors.background.primary,
		},
		loginTitle: {
			fontSize: 24,
			fontWeight: 'bold',
			marginBottom: 30,
			textAlign: 'center',
			color: colors.text.primary,
		},
		inputContainer: {
			flexDirection: 'row',
			alignItems: 'center',
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: layout.borderRadius.md,
			paddingHorizontal: spacing.md,
			marginBottom: spacing.md,
			backgroundColor: colors.background.secondary,
		},
		input: {
			flex: 1,
			padding: spacing.md,
			marginLeft: spacing.sm,
			fontSize: 16,
			color: colors.text.primary,
		},
		loginButton: {
			backgroundColor: colors.primary,
			padding: spacing.md,
			borderRadius: layout.borderRadius.md,
			marginTop: spacing.md,
		},
		loginButtonText: {
			color: colors.background.primary,
			textAlign: 'center',
			fontSize: 16,
			fontWeight: '500',
		},
		logoutButton: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			padding: spacing.md,
			margin: spacing.md,
			backgroundColor: colors.background.primary,
			borderRadius: layout.borderRadius.md,
			borderWidth: 1,
			borderColor: colors.danger,
		},
		logoutText: {
			color: colors.danger,
			marginLeft: spacing.sm,
			fontSize: 16,
			fontWeight: '500',
		},
		switchButton: {
			marginTop: spacing.md,
			padding: spacing.sm,
		},
		switchButtonText: {
			color: colors.primary,
			textAlign: 'center',
			fontSize: 14,
		},
		modalContainer: {
			flex: 1,
			backgroundColor: colors.background.overlay,
			justifyContent: 'center',
			padding: spacing.md,
		},
		modalContent: {
			backgroundColor: colors.background.primary,
			borderRadius: layout.borderRadius.lg,
			padding: spacing.md,
		},
		modalHeader: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'center',
			marginBottom: spacing.md,
		},
		modalTitle: {
			fontSize: 20,
			fontWeight: 'bold',
			color: colors.text.primary,
		},
		privacyOption: {
			flexDirection: 'row',
			alignItems: 'center',
			paddingVertical: spacing.md,
			borderBottomWidth: 1,
			borderBottomColor: colors.border,
		},
		privacyOptionText: {
			marginLeft: spacing.md,
			fontSize: 16,
			color: colors.primary,
		},
		deleteOption: {
			borderBottomWidth: 0,
		},
		deleteText: {
			color: colors.danger,
		},
		loadingOverlay: {
			position: 'absolute',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			backgroundColor: colors.background.overlay,
			justifyContent: 'center',
			alignItems: 'center',
		},
		safeArea: {
			flex: 1,
			backgroundColor: colors.background.primary,
		},
		logoContainer: {
			alignItems: 'center',
			marginBottom: spacing.lg,
			marginTop: spacing.xl,
		},
		logo: {
			width: 250,
			height: 36,
			marginBottom: spacing.xs,
		},
		authContainer: {
			flex: 1,
			justifyContent: 'center',
			paddingHorizontal: spacing.md,
			backgroundColor: colors.background.primary,
		},
		formContainer: {
			width: '100%',
			maxWidth: 400,
			alignSelf: 'center',
		},
		mascotContainer: {
			alignItems: 'center',
			marginBottom: spacing.lg,
		},
		mascot: {
			width: 120,
			height: 120,
			marginBottom: spacing.md,
		},
		welcomeText: {
			fontSize: 24,
			fontWeight: 'bold',
			color: colors.text.primary,
			marginBottom: spacing.sm,
			textAlign: 'center',
		},
		subtitleText: {
			fontSize: 16,
			color: colors.text.secondary,
			marginBottom: spacing.xl,
			textAlign: 'center',
		},
		card: {
			backgroundColor: colors.background.secondary,
			borderRadius: layout.borderRadius.lg,
			padding: spacing.lg,
			shadowColor: '#000',
			shadowOffset: {
				width: 0,
				height: 2,
			},
			shadowOpacity: 0.1,
			shadowRadius: 3.84,
			elevation: 5,
		},
		socialButton: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			backgroundColor: colors.background.primary,
			padding: spacing.md,
			borderRadius: layout.borderRadius.md,
			marginTop: spacing.md,
			borderWidth: 1,
			borderColor: colors.border,
		},
		socialButtonText: {
			color: colors.text.primary,
			marginLeft: spacing.sm,
			fontSize: 16,
			fontWeight: '500',
		},
		dividerContainer: {
			flexDirection: 'row',
			alignItems: 'center',
			marginVertical: spacing.md,
		},
		dividerLine: {
			flex: 1,
			height: 1,
			backgroundColor: colors.border,
		},
		dividerText: {
			color: colors.text.secondary,
			paddingHorizontal: spacing.md,
		},
		forgotPasswordButton: {
			alignSelf: 'flex-end',
			marginBottom: spacing.md,
			marginTop: -spacing.sm,
		},
		forgotPasswordText: {
			color: colors.primary,
			fontSize: 14,
		},
		// Profile Page
		headerContainer: {
			flexDirection: 'row',
			alignItems: 'center',
			padding: spacing.md,
			borderBottomWidth: 1,
			borderBottomColor: colors.border,
			backgroundColor: colors.background.secondary,
		},
		backButton: {
			flexDirection: 'row',
			alignItems: 'center',
			paddingVertical: spacing.sm,
		},
		headerTitle: {
			fontSize: 20,
			fontWeight: 'bold',
			color: colors.text.primary,
			marginLeft: spacing.sm,
		},
		profileImageSection: {
			alignItems: 'center',
			paddingVertical: spacing.xl,
		},
		profileImageContainer: {
			position: 'relative',
		},
		profileImage: {
			width: 120,
			height: 120,
			borderRadius: 60,
			backgroundColor: colors.background.secondary,
		},
		editImageButton: {
			position: 'absolute',
			right: 0,
			bottom: 0,
			backgroundColor: colors.primary,
			padding: spacing.sm,
			borderRadius: 20,
			borderWidth: 3,
			borderColor: colors.background.primary,
		},
		formSection: {
			padding: spacing.md,
		},
		inputGroup: {
			marginBottom: spacing.md,
		},
		label: {
			fontSize: 16,
			color: colors.text.secondary,
			marginBottom: spacing.xs,
		},
		input: {
			backgroundColor: colors.background.secondary,
			borderRadius: 8,
			padding: spacing.md,
		},
		inputText: {
			fontSize: 16,
			color: colors.text.primary,
		},
		defaultAvatarContainer: {
			width: 120,
			height: 120,
			justifyContent: 'center',
			alignItems: 'center',
		},		
	});

export const useStyles = () => {
	const { colors } = useTheme();
	return createStyles(colors);
};
