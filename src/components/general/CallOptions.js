import React from 'react';
import Constants from 'expo-constants';
import ActionModal from '../general/ActionModal';
import { callHandler } from '../../utils/callHandler';

const CallOptions = ({ show, contact, onClose }) => {
	const handleCall = async (callType) => {
		if (Constants.appOwnership === 'expo') {
			console.log('Call simulation in Expo Go:', callType, contact.phone);
			onClose();
			return;
		}

		try {
			console.log('[CallOptions] Initiating call:', { type: callType, contact: contact.id });
			await callHandler.initiateCall(contact, callType);
			console.log('[CallOptions] Call initiated successfully');
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
