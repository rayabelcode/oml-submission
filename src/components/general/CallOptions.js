import React from 'react';
import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import ActionModal from '../general/ActionModal';

const CallOptions = ({ show, contact, onClose }) => {
	const handleCall = async (callType) => {
		if (Constants.appOwnership === 'expo') {
			console.log('Call simulation in Expo Go:', callType, contact.phone);
			onClose();
			return;
		}

		if (Platform.OS === 'ios') {
			let urlScheme;
			switch (callType) {
				case 'facetime-video':
					urlScheme = `facetime://${contact.phone}`;
					break;
				case 'phone':
					urlScheme = `tel:${contact.phone}`;
					break;
				default:
					urlScheme = `tel:${contact.phone}`;
			}

			try {
				const supported = await Linking.canOpenURL(urlScheme);
				if (supported) {
					onClose();
					await Linking.openURL(urlScheme);
				}
			} catch (error) {
				console.error('Error initiating call:', error);
				onClose();
			}
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
