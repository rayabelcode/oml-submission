// Polyfill for URL support
import 'react-native-url-polyfill/auto';

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import TabNavigator from './src/navigation/TabNavigator';
import { LogBox } from 'react-native';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// Initialize Sentry
Sentry.init({
  dsn: Constants.expoConfig?.extra?.SENTRY_DSN // Use expoConfig for production builds
    || Constants.manifest?.extra?.SENTRY_DSN, // Fallback to manifest for development mode
  enableNative: false, // Required for Expo Managed Workflow
  debug: false // Disable debug logs in production
});

// Ignore specific Firebase warnings
LogBox.ignoreLogs([
  'Setting a timer',
  'AsyncStorage has been extracted from react-native core',
]);

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <TabNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
