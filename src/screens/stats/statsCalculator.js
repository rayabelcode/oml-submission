import { fetchUpcomingContacts } from '../../utils/firestore';

export const calculateStats = async (userId) => {
    try {
			const now = new Date();
			const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
			const allContacts = await fetchUpcomingContacts(userId);

			// Get time ranges for calculations
			const thirtyDaysAgo = new Date(now - 30 * 86400000);
			const ninetyDaysAgo = new Date(now - 90 * 86400000);

			// Calculate streak
			let streak = 0;
			const today = new Date().setHours(0, 0, 0, 0);
			let checkDate = today;
			let hasContact = true;

			while (hasContact) {
				const dateContacts = allContacts.some((contact) =>
					contact.contact_history?.some((h) => new Date(h.date).setHours(0, 0, 0, 0) === checkDate)
				);
				if (dateContacts) {
					streak++;
					checkDate -= 86400000;
				} else {
					hasContact = false;
				}
			}

			// Process contact data
			const contactStats = allContacts.map((contact) => ({
				name: `${contact.first_name} ${contact.last_name}`,
				thirtyDayCount: contact.contact_history?.filter((h) => new Date(h.date) >= thirtyDaysAgo).length || 0,
				ninetyDayCount: contact.contact_history?.filter((h) => new Date(h.date) >= ninetyDaysAgo).length || 0,
				lastContact: contact.contact_history?.[0]?.date || null,
				relationship: contact.relationship_type,
				preferredFrequency: contact.preferred_frequency || 30,
			}));

			// Monthly contact count
			const monthlyCount = allContacts.reduce((count, contact) => {
				return count + (contact.contact_history?.filter((h) => new Date(h.date) >= monthStart).length || 0);
			}, 0);

			// Calculate most active day
			const dayStats = allContacts.reduce((acc, contact) => {
				contact.contact_history?.forEach((h) => {
					const day = new Date(h.date).getDay();
					acc[day] = (acc[day] || 0) + 1;
				});
				return acc;
			}, {});

            return {
                basic: {
                    monthlyContacts: monthlyCount,
                    currentStreak: streak,
                    totalActive: allContacts.length,
                    averageContactsPerWeek: Math.round(monthlyCount / 4),
                },
                detailed: {
                    frequentContacts: contactStats
                        .filter((c) => c.thirtyDayCount > 0)
                        .sort((a, b) => b.thirtyDayCount - a.thirtyDayCount)
                        .slice(0, 5),
                    needsAttention: contactStats
                        .filter((c) => {
                            if (!c.lastContact) return true;
                            const daysSinceLastContact = Math.floor((now - new Date(c.lastContact)) / 86400000);
                            return daysSinceLastContact > c.preferredFrequency;
                        })
                        .sort((a, b) => {
                            if (!a.lastContact) return -1;
                            if (!b.lastContact) return 1;
                            return new Date(b.lastContact) - new Date(a.lastContact);
                        })
                        .slice(0, 5),
                    mostActiveDay: Number(Object.entries(dayStats).sort(([, a], [, b]) => b - a)[0]?.[0] || 0),
                },
                trends: {
                    ninetyDayTrend: contactStats.reduce((sum, contact) => sum + contact.ninetyDayCount, 0) / 3,
                },            
			};
		} catch (error) {
        console.error('Error calculating stats:', error);
        throw error;
    }
};
