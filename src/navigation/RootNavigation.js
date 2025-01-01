import { createNavigationContainerRef } from '@react-navigation/native';
import { EventEmitter } from 'fbemitter';

export const navigationRef = createNavigationContainerRef();
export const navigationEmitter = new EventEmitter();

export function navigate(name, params) {
	if (navigationRef.isReady()) {
		navigationRef.navigate(name, params);
	}
}
