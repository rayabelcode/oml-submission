import React from 'react';
import { View } from 'react-native';

const SafeAreaWrapper = ({ children }) => {
    return (
        <View style={{ flex: 1 }}>
            {children}
        </View>
    );
};

export default SafeAreaWrapper;
