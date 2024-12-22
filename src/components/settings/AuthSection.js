import React from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../context/ThemeContext';
import { useStyles } from '../../styles/screens/settings';

const AuthSection = ({
	isLogin,
	setIsLogin,
	email,
	setEmail,
	password,
	setPassword,
	handleAuth,
	loading,
}) => {
	const { colors } = useTheme();
	const styles = useStyles();

	return (
		<View style={styles.container}>
			<StatusBar style="auto" />
			<View style={styles.loginContainer}>
				<Text style={styles.loginTitle}>{isLogin ? 'Login to OnMyList' : 'Create Account'}</Text>

				<View style={styles.inputContainer}>
					<Icon name="mail-outline" size={20} color={colors.text.secondary} />
					<TextInput
						style={styles.input}
						placeholder="Email"
						value={email}
						onChangeText={setEmail}
						autoCapitalize="none"
						keyboardType="email-address"
						placeholderTextColor={colors.text.secondary}
					/>
				</View>

				<View style={styles.inputContainer}>
					<Icon name="key-outline" size={20} color={colors.text.secondary} />
					<TextInput
						style={styles.input}
						placeholder="Password"
						value={password}
						onChangeText={setPassword}
						secureTextEntry
						placeholderTextColor={colors.text.secondary}
					/>
				</View>

				<TouchableOpacity style={styles.loginButton} onPress={handleAuth} disabled={loading}>
					<Text style={styles.loginButtonText}>
						{loading ? 'Loading...' : isLogin ? 'Sign In' : 'Sign Up'}
					</Text>
				</TouchableOpacity>

				<TouchableOpacity style={styles.switchButton} onPress={() => setIsLogin(!isLogin)}>
					<Text style={styles.switchButtonText}>
						{isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
					</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
};

export default AuthSection;
