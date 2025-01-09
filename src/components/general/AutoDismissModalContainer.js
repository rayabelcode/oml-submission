import React, { useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const AutoDismissModalContainer = ({ message, isVisible }) => {
	const { colors } = useTheme();
	const opacity = new Animated.Value(0);

	useEffect(() => {
		if (isVisible) {
			opacity.setValue(0);
			Animated.sequence([
				Animated.timing(opacity, {
					toValue: 1,
					duration: 200,
					useNativeDriver: true,
				}),
				Animated.delay(800),
				Animated.timing(opacity, {
					toValue: 0,
					duration: 200,
					useNativeDriver: true,
				}),
			]).start();
		}
	}, [isVisible]);

	if (!isVisible) return null;

	return (
		<View style={styles.overlay}>
			<Animated.View
				style={[
					styles.messageContainer,
					{
						backgroundColor: colors.primary,
						opacity,
					},
				]}
			>
				<Text style={styles.message}>{message}</Text>
			</Animated.View>
		</View>
	);
};

const styles = StyleSheet.create({
	overlay: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		justifyContent: 'center',
		alignItems: 'center',
		zIndex: 999999,
		elevation: 999999,
		pointerEvents: 'none',
	},
	messageContainer: {
		padding: 15,
		borderRadius: 8,
		minWidth: 200,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 999999,
	},
	message: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: '500',
		textAlign: 'center',
	},
});

export default AutoDismissModalContainer;
