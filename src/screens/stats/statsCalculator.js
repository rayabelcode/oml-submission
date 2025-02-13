import { fetchUpcomingContacts, fetchContacts } from '../../utils/firestore';
import { FREQUENCY_MAPPINGS, RELATIONSHIP_TYPES } from '../../../constants/relationships';

export const calculateStats = async (userId) => {
	try {
		if (!userId) {
			console.error('No userId provided to calculateStats');
			return getDefaultStats();
		}

		const now = new Date();
		const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

		// Get ALL contacts for distribution
		const allContactsData = await fetchContacts(userId);
		const allContacts = [...allContactsData.scheduledContacts, ...allContactsData.unscheduledContacts].filter(
			(contact) => contact !== null && !contact.archived
		);

		// Get upcoming contacts for stats and suggestions
		const upcomingContacts = await fetchUpcomingContacts(userId);

		// Distribution calculation using ALL contacts
		const distribution = Object.keys(RELATIONSHIP_TYPES).map((type) => {
			const typeCount = allContacts.filter((contact) => {
				const directType = contact?.relationship_type;
				const schedulingType = contact?.scheduling?.relationship_type;
				return directType === type || schedulingType === type;
			}).length;

			return {
				type,
				count: typeCount,
				percentage: allContacts.length ? Math.round((typeCount / allContacts.length) * 100) : 0,
				color: RELATIONSHIP_TYPES[type].color,
				icon: RELATIONSHIP_TYPES[type].icon,
			};
		});

		// Stats calculations using upcoming contacts
		let streak = 0;
		const today = new Date().setHours(0, 0, 0, 0);
		let checkDate = today;
		let hasContact = true;

		while (hasContact) {
			const dateContacts = upcomingContacts.some((contact) =>
				contact?.contact_history?.some((h) => new Date(h.date).setHours(0, 0, 0, 0) === checkDate)
			);
			if (dateContacts) {
				streak++;
				checkDate -= 86400000;
			} else {
				hasContact = false;
			}
		}

		const thirtyDaysAgo = new Date(now - 30 * 86400000);
		const ninetyDaysAgo = new Date(now - 90 * 86400000);

		const monthlyCount = upcomingContacts.reduce((count, contact) => {
			return count + (contact.contact_history?.filter((h) => new Date(h.date) >= monthStart).length || 0);
		}, 0);

		// Calculate contact stats using upcoming contacts
		const contactStats = upcomingContacts.map((contact) => ({
			name: `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim(),
			thirtyDayCount: contact?.contact_history?.filter((h) => new Date(h.date) >= thirtyDaysAgo).length || 0,
			ninetyDayCount: contact?.contact_history?.filter((h) => new Date(h.date) >= ninetyDaysAgo).length || 0,
			lastContact: contact?.contact_history?.[0]?.date || null,
			relationship: contact?.relationship_type || 'unassigned',
			preferredFrequency: 30,
		}));

		// Calculate day stats using upcoming contacts
		const dayStats = {};
		upcomingContacts.forEach((contact) => {
			contact?.contact_history?.forEach((h) => {
				const day = new Date(h.date).getDay();
				dayStats[day] = (dayStats[day] || 0) + 1;
			});
		});

		// Calculate needs attention using upcoming contacts
		const needsAttention = upcomingContacts
			.filter((contact) => {
				if (!contact) return false;
				const lastContact = contact?.contact_history?.[0]?.date;

				if (!lastContact) return true;

				const daysSinceContact = Math.floor((now - new Date(lastContact)) / (1000 * 60 * 60 * 24));
				return daysSinceContact > 30;
			})
			.map((contact) => ({
				id: contact.id,
				name: `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim(),
				daysOverdue: contact?.contact_history?.[0]?.date
					? Math.floor((now - new Date(contact.contact_history[0].date)) / (1000 * 60 * 60 * 24))
					: Infinity,
				isOverdue: true,
				lastContact: contact?.contact_history?.[0]?.date,
			}))
			.sort((a, b) => b.daysOverdue - a.daysOverdue);

		return {
			basic: {
				monthlyContacts: monthlyCount,
				currentStreak: streak,
				totalActive: upcomingContacts.length,
				averageContactsPerWeek: Math.round(monthlyCount / 4),
			},
			detailed: {
				frequentContacts: contactStats
					.filter((c) => c.thirtyDayCount > 0)
					.sort((a, b) => b.thirtyDayCount - a.thirtyDayCount)
					.slice(0, 5),
				needsAttention,
				mostActiveDay: Number(Object.entries(dayStats).sort(([, a], [, b]) => b - a)[0]?.[0] || 0),
			},
			distribution,
			trends: {
				ninetyDayTrend: contactStats.reduce((sum, contact) => sum + contact.ninetyDayCount, 0) / 3,
			},
		};
	} catch (error) {
		console.error('Error calculating stats:', error);
		return getDefaultStats();
	}
};

const getDefaultStats = () => ({
	basic: {
		monthlyContacts: 0,
		currentStreak: 0,
		totalActive: 0,
		averageContactsPerWeek: 0,
	},
	detailed: {
		frequentContacts: [],
		needsAttention: [],
		mostActiveDay: 0,
	},
	distribution: [],
	trends: {
		ninetyDayTrend: 0,
	},
});
