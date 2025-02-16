import React from 'react';
import { InputAccessoryView, View, TouchableOpacity, Text, Platform, Keyboard } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const KeyboardDismiss = ({ inputAccessoryViewID }) => {
	const { colors } = useTheme();

	if (Platform.OS !== 'ios') return null;

	return (
		<InputAccessoryView nativeID={inputAccessoryViewID}>
			<View
				style={{
					backgroundColor: colors.background.secondary,
					borderTopWidth: 1,
					borderTopColor: colors.border,
					padding: 14,
					width: '100%',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<TouchableOpacity
					onPress={Keyboard.dismiss}
					style={{
						width: '100%',
						alignItems: 'center',
					}}
				>
					<Text
						style={{
							color: colors.primary,
							fontSize: 17,
							fontWeight: '600',
							textAlign: 'center',
						}}
					>
						Dismiss
					</Text>
				</TouchableOpacity>
			</View>
		</InputAccessoryView>
	);
};

export default KeyboardDismiss;
