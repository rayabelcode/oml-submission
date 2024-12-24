import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const AutoDismissModalContainer = ({ message, isVisible, onDismiss, delay = 2000 }) => {
    const { colors } = useTheme();
    const opacity = new Animated.Value(0);

    useEffect(() => {
        if (isVisible) {
            opacity.setValue(0);
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.delay(2000),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                })
            ]).start(() => {
                console.log('Animation complete, calling onDismiss');
                setTimeout(onDismiss, 300);
            });
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
                    }
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
        top: '50%',
        left: '50%',
        transform: [{ translateX: -100 }, { translateY: -25 }],
        width: 200,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
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
        elevation: 5,
    },
    message: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
    },
});

export default AutoDismissModalContainer;
