import { NavigationContainer } from '@react-navigation/native';
import TabNavigator from './src/navigation/TabNavigator.js';

export default function App() {
  return (
    <NavigationContainer>
      <TabNavigator />
    </NavigationContainer>
  );
}