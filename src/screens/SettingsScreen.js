import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Switch, TextInput, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { User, Bell, Lock, HelpCircle, LogOut, Mail, Key, UserPlus } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

export default function SettingsScreen() {
	const { user, signIn, signUp, signOut } = useAuth();
	const [isLogin, setIsLogin] = useState(true);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [notificationsEnabled, setNotificationsEnabled] = useState(true);

	async function handleAuth() {
		if (loading) return;

		// Basic validation
		if (!email || !password) {
			Alert.alert('Error', 'Please fill in all fields');
			return;
		}

		// Password validation - signup
		if (!isLogin && password.length < 6) {
			Alert.alert('Error', 'Password must be at least 6 characters');
			return;
		}

		setLoading(true);
		try {
			if (isLogin) {
				console.log('Attempting login...');
				const { error } = await signIn({
					email: email.trim(),
					password: password.trim(),
				});
				if (error) throw error;
			} else {
				console.log('Attempting registration...');
				const { error } = await signUp({
					email: email.trim(),
					password: password.trim(),
					options: {
						data: {
							email: email.trim(),
						},
					},
				});
				if (error) throw error;

				Alert.alert('Success', 'Registration successful! Please check your email for verification.', [
					{
						text: 'OK',
						onPress: () => {
							setIsLogin(true); // Switch to login screen
							setEmail('');
							setPassword('');
						},
					},
				]);
			}
		} catch (error) {
			console.error('Auth error:', error);
			let errorMessage = error.message;
			// Random error cases
			if (error.message.includes('Email not confirmed')) {
				errorMessage = 'Please check your email to confirm your account.';
			} else if (error.message.includes('Invalid login credentials')) {
				errorMessage = 'Invalid email or password.';
			}
			Alert.alert('Error', errorMessage);
		} finally {
			setLoading(false);
		}
	}

	async function handleLogout() {
		try {
			const { error } = await signOut();
			if (error) throw error;
		} catch (error) {
			Alert.alert('Error', error.message);
		}
	}

	if (!user) {
		return (
			<View style={styles.container}>
				<StatusBar style="auto" />
				<View style={styles.loginContainer}>
					<Text style={styles.loginTitle}>{isLogin ? 'Login to OnMyList' : 'Create Account'}</Text>

					<View style={styles.inputContainer}>
						<Mail size={20} color="#666" />
						<TextInput
							style={styles.input}
							placeholder="Email"
							value={email}
							onChangeText={setEmail}
							autoCapitalize="none"
							keyboardType="email-address"
						/>
					</View>

					<View style={styles.inputContainer}>
						<Key size={20} color="#666" />
						<TextInput
							style={styles.input}
							placeholder="Password"
							value={password}
							onChangeText={setPassword}
							secureTextEntry
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
	}

	return (
		<View style={styles.container}>
			<StatusBar style="auto" />

			<View style={styles.profileSection}>
				<View style={styles.avatar}>
					<User size={40} color="#007AFF" />
				</View>
				<View style={styles.profileInfo}>
					<Text style={styles.profileName}>{user.email}</Text>
					<Text style={styles.profileEmail}>Active Account</Text>
				</View>
			</View>

			<ScrollView style={styles.settingsList}>
				<View style={styles.settingSection}>
					<Text style={styles.sectionTitle}>Notifications</Text>
					<View style={styles.settingItem}>
						<View style={styles.settingItemLeft}>
							<Bell size={20} color="#666" />
							<Text style={styles.settingText}>Push Notifications</Text>
						</View>
						<Switch
							value={notificationsEnabled}
							onValueChange={setNotificationsEnabled}
							trackColor={{ false: '#767577', true: '#81b0ff' }}
							thumbColor={notificationsEnabled ? '#007AFF' : '#f4f3f4'}
						/>
					</View>
				</View>

				<View style={styles.settingSection}>
					<Text style={styles.sectionTitle}>Privacy</Text>
					<TouchableOpacity style={styles.settingItem}>
						<View style={styles.settingItemLeft}>
							<Lock size={20} color="#666" />
							<Text style={styles.settingText}>Privacy Settings</Text>
						</View>
					</TouchableOpacity>
				</View>

				<View style={styles.settingSection}>
					<Text style={styles.sectionTitle}>Support</Text>
					<TouchableOpacity style={styles.settingItem}>
						<View style={styles.settingItemLeft}>
							<HelpCircle size={20} color="#666" />
							<Text style={styles.settingText}>Help Center</Text>
						</View>
					</TouchableOpacity>
				</View>

				<TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
					<LogOut size={20} color="#FF3B30" />
					<Text style={styles.logoutText}>Log Out</Text>
				</TouchableOpacity>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#fff',
	},
	profileSection: {
		flexDirection: 'row',
		padding: 20,
		backgroundColor: '#f8f9fa',
		alignItems: 'center',
	},
	avatar: {
		width: 60,
		height: 60,
		borderRadius: 30,
		backgroundColor: '#e9ecef',
		justifyContent: 'center',
		alignItems: 'center',
	},
	profileInfo: {
		marginLeft: 15,
	},
	profileName: {
		fontSize: 18,
		fontWeight: 'bold',
	},
	profileEmail: {
		color: '#666',
	},
	settingsList: {
		flex: 1,
	},
	settingSection: {
		padding: 15,
		borderBottomWidth: 1,
		borderBottomColor: '#eee',
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: '500',
		marginBottom: 10,
		color: '#666',
	},
	settingItem: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 10,
	},
	settingItemLeft: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	settingText: {
		marginLeft: 15,
		fontSize: 16,
	},
	logoutButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 15,
		margin: 15,
		backgroundColor: '#fff',
		borderRadius: 10,
		borderWidth: 1,
		borderColor: '#FF3B30',
	},
	logoutText: {
		color: '#FF3B30',
		marginLeft: 10,
		fontSize: 16,
		fontWeight: '500',
	},
	loginContainer: {
		flex: 1,
		padding: 20,
		justifyContent: 'center',
	},
	loginTitle: {
		fontSize: 24,
		fontWeight: 'bold',
		marginBottom: 30,
		textAlign: 'center',
	},
	inputContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 10,
		paddingHorizontal: 15,
		marginBottom: 15,
	},
	input: {
		flex: 1,
		padding: 15,
		marginLeft: 10,
		fontSize: 16,
	},
	loginButton: {
		backgroundColor: '#007AFF',
		padding: 15,
		borderRadius: 10,
		marginTop: 15,
	},
	loginButtonText: {
		color: '#fff',
		textAlign: 'center',
		fontSize: 16,
		fontWeight: '500',
	},
	switchButton: {
		marginTop: 15,
		padding: 10,
	},
	switchButtonText: {
		color: '#007AFF',
		textAlign: 'center',
		fontSize: 14,
	},
});
