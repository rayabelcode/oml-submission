import { useTheme } from '../context/ThemeContext';

export function useLogo() {
	const { effectiveTheme } = useTheme();

	// Use dark logo for both dark and dimmed modes
	if (effectiveTheme === 'dark' || effectiveTheme === 'dimmed') {
		return require('../../assets/full-logo-darkmode.png');
	}
	return require('../../assets/full-logo-color.png');
}
