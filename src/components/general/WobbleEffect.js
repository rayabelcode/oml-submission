import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, Animated, View, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';

const WobbleEffect = ({
	children,
	isEditing,
	onLongPress,
	onPress,
	onDeletePress,
	onMeasureDeleteButton,
	style,
	disabled = false,
}) => {
	const { colors } = useTheme();
	const rotation = useRef(new Animated.Value(0)).current;
	const deleteButtonRef = useRef(null);

	useEffect(() => {
		if (isEditing) {
			startWobble();
		} else {
			rotation.setValue(0);
		}
	}, [isEditing]);

	useEffect(() => {
		if (isEditing && deleteButtonRef.current) {
			deleteButtonRef.current.measure((x, y, width, height, pageX, pageY) => {
				onMeasureDeleteButton?.({ x: pageX, y: pageY, width, height });
			});
		}
	}, [isEditing]);

	const startWobble = () => {
		Animated.loop(
			Animated.sequence([
				Animated.timing(rotation, {
					toValue: 0.05,
					duration: 100,
					useNativeDriver: true,
				}),
				Animated.timing(rotation, {
					toValue: -0.05,
					duration: 100,
					useNativeDriver: true,
				}),
			])
		).start();
	};

	return (
		<View style={[styles.container, style]}>
			<Animated.View
				style={[
					styles.content,
					{
						transform: [
							{
								rotate: rotation.interpolate({
									inputRange: [-1, 1],
									outputRange: ['-1rad', '1rad'],
								}),
							},
						],
					},
					{ alignItems: 'center' },
				]}
			>
				{children}
			</Animated.View>
			{isEditing && (
				<TouchableOpacity
					ref={deleteButtonRef}
					style={styles.deleteButton}
					onPress={(e) => {
						e.stopPropagation();
						onDeletePress?.();
					}}
					hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
				>
					<Icon name="remove-circle" size={36} color={colors.danger || 'red'} />
				</TouchableOpacity>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		position: 'relative',
		width: '100%',
		alignItems: 'center',
	},
	content: {
		position: 'relative',
		width: '100%',
		alignItems: 'center',
	},
	deleteButton: {
		position: 'absolute',
		top: -18,
		right: -18,
		zIndex: 1000,
		elevation: 5,
		backgroundColor: 'transparent',
		padding: 10,
	},
});

export default WobbleEffect;
