// src/styles/screens/dashboard.js
import { StyleSheet, Platform } from 'react-native';
import { colors, spacing, layout } from '../theme';

export default StyleSheet.create({
	// Layout containers
	container: {
		flex: 1,
		backgroundColor: colors.background,
		paddingTop: Platform.OS === 'ios' ? 50 : 0,
	},
	contactsList: {
		flex: 1,
		padding: spacing.md,
	},
	statsContainer: {
		flex: 1,
		padding: spacing.md,
	},

	// Header styles
	header: {
		padding: spacing.md,
		alignItems: 'center',
	},
	title: {
		fontSize: 24,
		fontWeight: 'bold',
		textAlign: 'center',
	},

	// Navigation buttons
	buttonContainer: {
		flexDirection: 'row',
		paddingHorizontal: spacing.md,
		paddingBottom: spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: colors.border,
	},
	toggleButton: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		padding: spacing.sm,
		backgroundColor: '#f8f9fa',
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
	toggleButtonActive: {
		backgroundColor: '#e8f2ff',
	},

	// Contact card styles
	card: {
		backgroundColor: '#f8f9fa',
		padding: spacing.md,
		borderRadius: layout.borderRadius.md,
		marginBottom: spacing.sm,
		borderWidth: 1,
		borderColor: colors.border,
	},
	cardHeader: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	cardInfo: {
		flex: 1,
	},
	cardName: {
		fontSize: 16,
		fontWeight: '500',
		marginBottom: 4,
	},
	cardDate: {
		fontSize: 14,
		color: colors.text.secondary,
	},

	// Avatar styles
	avatarContainer: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: '#e8f2ff',
		justifyContent: 'center',
		alignItems: 'center',
		marginRight: spacing.sm,
	},
	avatar: {
		width: 40,
		height: 40,
		borderRadius: 20,
	},

	// Stats card styles
	statCard: {
		backgroundColor: '#f8f9fa',
		padding: spacing.md,
		borderRadius: layout.borderRadius.md,
		marginBottom: spacing.md,
		borderWidth: 1,
		borderColor: colors.border,
	},
	statTitle: {
		fontSize: 16,
		fontWeight: '600',
		color: colors.text.secondary,
		marginBottom: spacing.sm,
	},
	statValue: {
		fontSize: 36,
		fontWeight: 'bold',
		color: colors.primary,
		marginBottom: 5,
	},
	statLabel: {
		fontSize: 14,
		color: colors.text.secondary,
	},
	statListItem: {
		fontSize: 16,
		color: colors.text.primary,
		paddingVertical: spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: colors.border,
	},

	// Message styles
	message: {
		textAlign: 'center',
		padding: spacing.md,
		color: colors.text.secondary,
		fontSize: 16,
	},
	congratsMessage: {
		fontSize: 16,
		color: '#3e8b00',
		textAlign: 'left',
		paddingVertical: spacing.sm,
		fontStyle: 'italic',
		fontWeight: '600',
	},
});
