import { StyleSheet } from 'react-native';

export const createStyles = (colors) =>
	StyleSheet.create({
		modalContainer: {
			flex: 1,
			justifyContent: 'center',
			alignItems: 'center',
			backgroundColor: 'rgba(0, 0, 0, 0.5)',
		},
		modalContent: {
			width: '85%',
			maxWidth: 340,
			backgroundColor: colors.background.primary,
			borderRadius: 15,
			padding: 20,
			maxHeight: '80%',
		},
		modalTitle: {
			fontSize: 22,
			fontWeight: '700',
			color: colors.text.primary,
			marginBottom: 15,
			textAlign: 'center',
		},
		tabSelector: {
			flexDirection: 'row',
			marginBottom: 15,
			borderRadius: 10,
			backgroundColor: colors.background.secondary,
			padding: 4,
		},
		tab: {
			flex: 1,
			paddingVertical: 8,
			alignItems: 'center',
			borderRadius: 8,
		},
		activeTab: {
			backgroundColor: colors.primary,
		},
		tabText: {
			color: colors.text.secondary,
			fontWeight: '600',
		},
		activeTabText: {
			color: colors.text.white,
		},
		tabContent: {
			flex: 1,
		},
		section: {
			marginBottom: 15,
		},
		sectionTitle: {
			fontSize: 18,
			fontWeight: '600',
			color: colors.text.primary,
			marginBottom: 10,
		},
		birthdayAlert: {
			flexDirection: 'row',
			alignItems: 'center',
			backgroundColor: colors.background.highlight,
			padding: 15,
			borderRadius: 10,
			marginBottom: 15,
		},
		birthdayText: {
			marginLeft: 10,
			color: colors.text.primary,
			fontSize: 16,
		},
		momentCard: {
			backgroundColor: colors.background.secondary,
			padding: 15,
			borderRadius: 10,
			marginBottom: 8,
		},
		suggestionCard: {
			backgroundColor: colors.background.secondary,
			padding: 15,
			borderRadius: 10,
			marginBottom: 8,
		},
		flowStep: {
			flexDirection: 'row',
			alignItems: 'flex-start',
			marginBottom: 12,
		},
		stepNumber: {
			width: 28,
			height: 28,
			borderRadius: 14,
			backgroundColor: colors.primary,
			alignItems: 'center',
			justifyContent: 'center',
			marginRight: 10,
		},
		stepNumberText: {
			color: colors.text.white,
			fontWeight: '600',
		},
		stepContent: {
			flex: 1,
		},
		jokeCard: {
			backgroundColor: colors.background.secondary,
			padding: 15,
			borderRadius: 10,
			marginBottom: 8,
		},
		closeButton: {
			position: 'absolute',
			top: 15,
			right: 15,
			padding: 5,
		},
		loadingContainer: {
			padding: 20,
			alignItems: 'center',
		},
		loadingText: {
			marginTop: 10,
			color: colors.text.primary,
		},
		momentText: {
			color: colors.text.primary,
		},
		suggestionText: {
			color: colors.text.primary,
		},
		stepTitle: {
			color: colors.text.primary,
			fontWeight: '600',
			marginBottom: 4,
		},
		stepDescription: {
			color: colors.text.secondary,
		},
		jokeText: {
			color: colors.text.primary,
		},
	});
