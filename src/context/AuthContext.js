import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../config/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		// Check active sessions
		checkUser();

		// Listen for auth changes
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setUser(session?.user ?? null);
		});

		return () => subscription.unsubscribe();
	}, []);

	const checkUser = async () => {
		try {
			const {
				data: { session },
				error,
			} = await supabase.auth.getSession();
			if (error) throw error;
			setUser(session?.user ?? null);
		} catch (error) {
			console.error('Error checking user:', error.message);
		} finally {
			setLoading(false);
		}
	};

	const signIn = async ({ email, password }) => {
		try {
			const { data, error } = await supabase.auth.signInWithPassword({
				email,
				password,
			});
			if (error) throw error;
			return { data, error: null };
		} catch (error) {
			return { data: null, error };
		}
	};

	const signUp = async ({ email, password }) => {
		try {
			const { data, error } = await supabase.auth.signUp({
				email,
				password,
			});
			if (error) throw error;
			return { data, error: null };
		} catch (error) {
			return { data: null, error };
		}
	};

	const signOut = async () => {
		try {
			const { error } = await supabase.auth.signOut();
			if (error) throw error;
			return { error: null };
		} catch (error) {
			return { error };
		}
	};

	const value = {
		user,
		signUp,
		signIn,
		signOut,
		loading,
	};

	return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
};
