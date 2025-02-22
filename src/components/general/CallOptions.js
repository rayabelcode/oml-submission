import React from 'react';
import Constants from 'expo-constants';
import ActionModal from './ActionModal';
import { callHandler } from '../../utils/callHandler';
import { useTheme } from '../../context/ThemeContext';

const CallOptions = ({ show, contact, onClose, reminder, onComplete }) => {
	const { colors } = useTheme();

	const handleCall = async (callType) => {
		if (Constants.appOwnership === 'expo') {
			onClose();
			return;
		}

		try {
			// Initiate a call
			const success = await callHandler.initiateCall(contact, callType);

			// If call was successful and there is NotificationsView reminder to complete
			if (success && reminder && (reminder.type === 'SCHEDULED' || reminder.type === 'CUSTOM_DATE')) {
				await onComplete(reminder.firestoreId);
			}

			// Close the modal
			onClose();
		} catch (error) {
			console.error('Error handling call:', error);
			onClose();
		}
	};

	const options = [
		{
			id: 'phone',
			icon: 'call-outline',
			text: 'Call',
			iconColor: colors.secondary,
			textColor: colors.text.primary,
			onPress: () => handleCall('phone'),
		},
		{
			id: 'facetime',
			icon: 'videocam-outline',
			text: 'FaceTime',
			iconColor: colors.secondary,
			textColor: colors.text.primary,
			onPress: () => handleCall('facetime-video'),
		},
		{
			id: 'text',
			icon: 'chatbox-ellipses-outline',
			text: 'Text',
			iconColor: colors.primary,
			textColor: colors.text.primary,
			onPress: () => handleCall('sms'),
		},
	];

	const title = `Contact ${contact.first_name}`;

	return <ActionModal show={show} onClose={onClose} options={options} title={title} />;
};

export default CallOptions;
