import React, { useRef } from 'react';
import {
	View,
	Text,
	TouchableOpacity,
	TextInput,
	KeyboardAvoidingView,
	Platform,
	Image,
	ScrollView,
	SafeAreaView,
	Animated,
} from 'react-native';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import * as AppleAuthentication from 'expo-apple-authentication';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { useStyles } from '../../styles/screens/settings';
import { useAuth } from '../../context/AuthContext';
import { useLogo } from '../../hooks/useLogo';

const AuthSection = ({
	isLogin,
	setIsLogin,
	email,
	setEmail,
	password,
	setPassword,
	handleAuth,
	loading,
	onForgotPassword,
	signInWithApple,
}) => {
	const { colors, theme } = useTheme();
	const styles = useStyles();
	const passwordInputRef = useRef(null);
	const { isAppleUser } = useAuth();

	const logoSource = useLogo();

	const handleAppleSignIn = async () => {
		try {
			const result = await signInWithApple();
			if (result.error) {
				console.log(result.error);
			}
		} catch (error) {
			console.log(error);
		}
	};

	return (
		<SafeAreaView style={styles.safeArea}>
			<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
				<ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
					<View style={styles.authContainer}>
						<View style={styles.logoContainer}>
							<Image source={logoSource} style={styles.logo} resizeMode="contain" />
						</View>

						<View style={styles.mascotContainer}>
							<Image
								source={require('../../../assets/images/sloth.png')}
								style={styles.mascot}
								resizeMode="contain"
							/>
							<Text style={styles.welcomeText}>{isLogin ? 'Welcome Back' : 'Keep Your Circle Tight'}</Text>
						</View>

						<View style={styles.segmentedControlContainer}>
							<SegmentedControl
								values={['Sign In', 'Register']}
								selectedIndex={isLogin ? 0 : 1}
								onChange={(event) => {
									setIsLogin(event.nativeEvent.selectedSegmentIndex === 0);
								}}
								style={styles.segmentedControl}
								backgroundColor={colors.background.primary}
								tintColor={colors.primary}
								fontStyle={styles.segmentedControlText}
								activeFontStyle={styles.segmentedControlActiveText}
							/>
						</View>

						<View style={styles.card}>
							<View style={styles.authInputContainer}>
								<Icon
									name="mail-outline"
									size={20}
									color={colors.text.secondary}
									style={{ marginRight: 8 }}
								/>
								<TextInput
									style={styles.authInput}
									placeholder="Email"
									value={email}
									onChangeText={setEmail}
									autoCapitalize="none"
									autoCorrect={false}
									keyboardType="email-address"
									placeholderTextColor={colors.text.secondary}
									returnKeyType="next"
									onSubmitEditing={() => passwordInputRef.current?.focus()}
									blurOnSubmit={false}
									editable={!isAppleUser()}
									textContentType="emailAddress"
									autoComplete="email"
									spellCheck={false}
									clearButtonMode="while-editing"
								/>
							</View>

							<View style={styles.authInputContainer}>
								<Icon name="key-outline" size={20} color={colors.text.secondary} style={{ marginRight: 8 }} />
								<TextInput
									ref={passwordInputRef}
									style={styles.authInput}
									placeholder="Password"
									value={password}
									onChangeText={setPassword}
									secureTextEntry
									autoCapitalize="none"
									placeholderTextColor={colors.text.secondary}
									returnKeyType="done"
									onSubmitEditing={handleAuth}
									textContentType={isLogin ? 'password' : 'newPassword'}
									autoComplete={isLogin ? 'current-password' : 'new-password'}
									passwordRules="minlength: 8;"
									autoCorrect={false}
									spellCheck={false}
								/>
							</View>

							<TouchableOpacity
								style={[styles.loginButton, loading && { opacity: 0.7 }]}
								onPress={handleAuth}
								disabled={loading}
							>
								<Text style={styles.loginButtonText}>
									{loading ? 'Loading...' : isLogin ? 'Sign In' : 'Register'}
								</Text>
							</TouchableOpacity>

							<View style={styles.forgotPasswordContainer}>
								{isLogin && (
									<TouchableOpacity style={styles.forgotPasswordButton} onPress={onForgotPassword}>
										<Text style={styles.forgotPasswordText}>Forgot Password?</Text>
									</TouchableOpacity>
								)}
							</View>

							<View style={styles.dividerContainer}>
								<View style={styles.dividerLine} />
								<Text style={styles.dividerText}>or</Text>
								<View style={styles.dividerLine} />
							</View>

							<TouchableOpacity style={styles.socialButton} onPress={handleAppleSignIn}>
								<Icon name="logo-apple" size={22} color={colors.text.primary} />
								<Text style={styles.socialButtonText}>Continue with Apple</Text>
							</TouchableOpacity>
						</View>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
};

export default AuthSection;
