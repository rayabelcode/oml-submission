import React, { createContext, useContext, useState, useEffect } from 'react';
import { calculateStats } from '../screens/stats/statsCalculator';
import { cacheManager } from '../utils/cache';
import { fetchContacts, fetchUpcomingContacts } from '../utils/firestore';
import { useAuth } from './AuthContext';

const PreloadContext = createContext({});

export const PreloadProvider = ({ children }) => {
	const { user } = useAuth();
	const [isPreloaded, setIsPreloaded] = useState(false);

	useEffect(() => {
		if (user && !isPreloaded) {
			preloadData();
		}
	}, [user]);

	const preloadData = async () => {
		if (!user) return;

		try {
			// Preload in background without blocking UI
			Promise.all([
				fetchContacts(user.uid).then((contacts) => cacheManager.saveContacts(user.uid, contacts)),
				fetchUpcomingContacts(user.uid).then((contacts) =>
					cacheManager.saveUpcomingContacts(user.uid, contacts)
				),
				calculateStats(user.uid).then((stats) => cacheManager.saveStats(user.uid, stats)),
			])
				.then(() => {
					setIsPreloaded(true);
				})
				.catch((error) => {
					console.error('Background preload error:', error);
					setIsPreloaded(true); // Mark as preloaded even on error
				});
		} catch (error) {
			console.error('Error initiating preload:', error);
			setIsPreloaded(true);
		}
	};

	return <PreloadContext.Provider value={{ isPreloaded }}>{children}</PreloadContext.Provider>;
};

export const usePreload = () => useContext(PreloadContext);
