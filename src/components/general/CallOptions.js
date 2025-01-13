import React from 'react';
import Constants from 'expo-constants';
import ActionModal from '../general/ActionModal';
import { callHandler } from '../../../App';

const CallOptions = ({ show, contact, onClose }) => {
	const handleCall = async (callType) => {
		if (Constants.appOwnership === 'expo') {
			onClose();
			return;
		}

		try {
			await callHandler.initiateCall(contact, callType);
			onClose();
		} catch (error) {
			console.error('[CallOptions] Error initiating call:', error);
			onClose();
		}
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
