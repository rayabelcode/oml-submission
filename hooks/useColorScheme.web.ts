import { useTheme } from '@/src/context/ThemeContext';

export function useColorScheme() {
  const { theme } = useTheme();
  return theme;
}