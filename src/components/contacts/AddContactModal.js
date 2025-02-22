import React from 'react';
import ActionModal from '../general/ActionModal';
import { useTheme } from '../../context/ThemeContext';

const AddContactModal = ({ show, onClose, onImport, onNew }) => {
	const { colors } = useTheme();

	const options = [
		{
			id: 'import',
			icon: 'people',
			text: 'Import Contact',
			iconColor: colors.primary,
			textColor: colors.text.primary,
			onPress: onImport,
		},
		{
			id: 'new',
			icon: 'add-circle-outline',
			text: 'Create New',
			iconColor: colors.secondary,
			textColor: colors.text.primary,
			onPress: onNew,
		},
	];

	return <ActionModal show={show} onClose={onClose} options={options} title="Add Contact" />;
};

export default AddContactModal;
