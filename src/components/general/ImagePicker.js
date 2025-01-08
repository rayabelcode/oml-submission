import React from 'react';
import { Alert } from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';

/**
 * Image picker with predefined settings | image selection | cropping
 * @param {Function} onImagePicked - Callback function that receives the cropped image path
 */
const ImagePickerComponent = async (onImagePicked) => {
	try {
		// Image picker with fixed settings
		const image = await ImagePicker.openPicker({
			width: 400, // Cropped image width
			height: 400, // Cropped image height
			cropping: true, // Enable cropping
			cropperCircleOverlay: true, // Disable circular cropping
			compressImageQuality: 0.4, // Compress image quality
			cropperToolbarTitle: 'Crop Your Photo', // Toolbar title
		});

		// Pass the selected/cropped image path back to the caller
		if (onImagePicked) {
			onImagePicked(image.path);
		}
	} catch (error) {
		if (error.code === 'E_PICKER_CANCELLED') {
			// Handle cancellation without error
			return;
		}
		// Handle other errors
		console.error('Image Picker Error:', error);
		Alert.alert('Error', 'Failed to pick an image.');
	}
};

export default ImagePickerComponent;
