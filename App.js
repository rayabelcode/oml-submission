import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import TabNavigator from './src/navigation/TabNavigator';

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <TabNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}