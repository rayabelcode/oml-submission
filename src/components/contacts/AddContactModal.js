import React from 'react';
import ActionModal from '../general/ActionModal';

const AddContactModal = ({ show, onClose, onImport, onNew }) => {
	const options = [
		{
			id: 'import',
			icon: 'people-outline',
			text: 'Import Existing',
			onPress: onImport,
		},
		{
			id: 'new',
			icon: 'add-circle-outline',
			text: 'Create New',
			onPress: onNew,
		},
	];

	return <ActionModal show={show} onClose={onClose} options={options} title="Add Contact" />;
};

export default AddContactModal;
