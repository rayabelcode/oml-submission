import React from 'react';
import Constants from 'expo-constants';
import ActionModal from './ActionModal';
import { callHandler } from '../../utils/callHandlerInstance';

const CallOptions = ({ show, contact, onClose }) => {
	const handleCall = async (callType) => {
		if (Constants.appOwnership === 'expo') {
			onClose();
			return;
		}
		await callHandler.handleCallAction(contact, callType, onClose);
	};

	const options = [
		{
			id: 'phone',
			icon: 'call-outline',
			text: `Call ${contact.first_name}`,
			onPress: () => handleCall('phone'),
		},
		{
			id: 'facetime',
			icon: 'videocam-outline',
			text: `FaceTime ${contact.first_name}`,
			onPress: () => handleCall('facetime-video'),
		},
	];

	return <ActionModal show={show} onClose={onClose} options={options} />;
};

export default CallOptions;
