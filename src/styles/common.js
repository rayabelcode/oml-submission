// src/styles/common.js
import { StyleSheet, Platform } from 'react-native';
import { colors, spacing, layout } from './theme';

export default StyleSheet.create({
	// Layout containers
	container: {
		flex: 1,
		backgroundColor: colors.background.primary,
		paddingTop: Platform.OS === 'ios' ? 50 : 0,
	},
	content: {
		flex: 1,
	},

	// Card styles
	card: {
		backgroundColor: colors.background.secondary,
		padding: spacing.md,
		borderRadius: layout.borderRadius.md,
		marginBottom: spacing.sm,
		borderWidth: 1,
		borderColor: colors.border,
	},

	// Modal styles
	modalContainer: {
		flex: 1,
		backgroundColor: colors.background.overlay,
		justifyContent: 'center',
		alignItems: 'center',
		width: '100%',
	},
	modalContent: {
		backgroundColor: colors.background.primary,
		borderRadius: layout.borderRadius.lg,
		padding: spacing.md,
		width: Platform.OS === 'web' ? '50%' : '85%',
		alignSelf: 'center',
		maxHeight: Platform.OS === 'ios' ? '75%' : '90%',
		...(Platform.OS === 'ios'
			? {
					height: '75%',
			  }
			: {}),
	},
	modalHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: spacing.md,
		position: 'relative',
		paddingHorizontal: spacing.md,
	},
	modalTitle: {
		fontSize: 24,
		fontWeight: 'bold',
		textAlign: 'center',
	},

	// Button styles
	primaryButton: {
		backgroundColor: colors.primary,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
		borderRadius: layout.borderRadius.md,
		alignItems: 'center',
		justifyContent: 'center',
		flexDirection: 'row',
	},
	primaryButtonText: {
		color: colors.background.primary,
		fontSize: 16,
		fontWeight: '500',
	},
	secondaryButton: {
		backgroundColor: colors.background.primary,
		borderWidth: 1,
		borderColor: colors.primary,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
		borderRadius: layout.borderRadius.md,
		alignItems: 'center',
		justifyContent: 'center',
		flexDirection: 'row',
	},
	secondaryButtonText: {
		color: colors.primary,
		fontSize: 16,
		fontWeight: '500',
	},
	toggleButton: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		padding: spacing.sm,
		backgroundColor: colors.background.secondary,
		margin: 5,
		borderRadius: layout.borderRadius.md,
		borderWidth: 1,
		borderColor: colors.primary,
	},
	toggleButtonText: {
		marginLeft: spacing.sm,
		fontSize: 16,
		color: colors.primary,
		fontWeight: '500',
	},

	// Form styles
	input: {
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: layout.borderRadius.md,
		padding: spacing.md,
		fontSize: 16,
		color: colors.text.primary,
		backgroundColor: colors.background.primary,
	},
	inputContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: layout.borderRadius.md,
		paddingHorizontal: spacing.md,
		marginBottom: spacing.md,
	},

	// Message styles
	message: {
		textAlign: 'center',
		padding: spacing.md,
		color: colors.text.secondary,
		fontSize: 16,
	},

	// Loading overlay
	loadingOverlay: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(255, 255, 255, 0.8)',
		justifyContent: 'center',
		alignItems: 'center',
	},

	// Section styles
	section: {
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

	// Avatar styles
	avatar: {
		width: 60,
		height: 60,
		borderRadius: 30,
		backgroundColor: colors.background.secondary,
		justifyContent: 'center',
		alignItems: 'center',
	},
	avatarImage: {
		width: '100%',
		height: '100%',
		borderRadius: 30,
	},
});
