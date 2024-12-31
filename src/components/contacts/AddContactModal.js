import React from 'react';
import ActionModal from '../general/ActionModal';

const AddContactModal = ({ show, onClose, onImport, onNew }) => {
	const options = [
		{
			id: 'import',
			icon: 'people-outline',
			text: 'Import from Contacts',
			onPress: onImport,
		},
		{
			id: 'new',
			icon: 'add-outline',
			text: 'Create New Contact',
			onPress: onNew,
		},
	];

	return <ActionModal show={show} onClose={onClose} options={options} />;
};

export default AddContactModal;
