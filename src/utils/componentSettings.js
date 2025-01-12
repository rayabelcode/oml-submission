import { AvoidSoftInput } from 'react-native-avoid-softinput';

// AvoidSoftInput (react-native-avoid-softinput) - Global Settings
// https://mateusz1913.github.io/react-native-avoid-softinput/docs/guides
export const setupAvoidSoftInputGlobalSettings = () => {
	// Set a global offset (how much the screen will be able to be shifted up)
	AvoidSoftInput.setAvoidOffset(5); // Shift all layouts globally when the keyboard appears

	// Set animation delays and durations
	AvoidSoftInput.setShowAnimationDelay(50); // Delay before keyboard show animation starts
	AvoidSoftInput.setShowAnimationDuration(300); // Duration for keyboard show animation
	AvoidSoftInput.setHideAnimationDelay(50); // Delay before keyboard hide animation starts
	AvoidSoftInput.setHideAnimationDuration(300); // Duration for keyboard hide animation
};
