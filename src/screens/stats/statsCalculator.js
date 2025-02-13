import { fetchUpcomingContacts } from '../../utils/firestore';
import { FREQUENCY_MAPPINGS, RELATIONSHIP_TYPES } from '../../../constants/relationships';

export const calculateStats = async (userId) => {
	try {
		if (!userId) {
			console.error('No userId provided to calculateStats');
			return getDefaultStats();
		}

		const now = new Date();
		const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

		const allContacts = await fetchUpcomingContacts(userId);

		if (!allContacts || !Array.isArray(allContacts)) {
			console.error('Invalid contacts data:', allContacts);
			return getDefaultStats();
		}

		const contacts = allContacts.filter((contact) => contact !== null);

		// Distribution calculation
		const typeCount = {};
		contacts.forEach((contact) => {
			const type = contact?.relationship_type || 'unassigned';
			typeCount[type] = (typeCount[type] || 0) + 1;
		});

		// Distribution calculation
		const distribution = Object.entries(RELATIONSHIP_TYPES)
			.map(([type, config]) => {
				const count = contacts.filter((contact) => contact?.relationship_type === type).length;
				return {
					type,
					count,
					percentage: contacts.length ? Math.round((count / contacts.length) * 100) : 0,
					color: config.color,
					icon: config.icon,
				};
			})
			.filter((item) => item.count > 0);

		// Basic stats calculations
		let streak = 0;
		const today = new Date().setHours(0, 0, 0, 0);
		let checkDate = today;
		let hasContact = true;

		while (hasContact) {
			const dateContacts = contacts.some((contact) =>
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

		const monthlyCount = contacts.reduce((count, contact) => {
			return count + (contact.contact_history?.filter((h) => new Date(h.date) >= monthStart).length || 0);
		}, 0);

		// Calculate contact stats
		const contactStats = contacts.map((contact) => ({
			name: `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim(),
			thirtyDayCount: contact?.contact_history?.filter((h) => new Date(h.date) >= thirtyDaysAgo).length || 0,
			ninetyDayCount: contact?.contact_history?.filter((h) => new Date(h.date) >= ninetyDaysAgo).length || 0,
			lastContact: contact?.contact_history?.[0]?.date || null,
			relationship: contact?.relationship_type || 'unassigned',
			preferredFrequency: 30, // Default to monthly if not specified
		}));

		// Calculate day stats
		const dayStats = {};
		contacts.forEach((contact) => {
			contact?.contact_history?.forEach((h) => {
				const day = new Date(h.date).getDay();
				dayStats[day] = (dayStats[day] || 0) + 1;
			});
		});

		// Calculate needs attention
		const needsAttention = contacts
			.filter((contact) => {
				if (!contact) return false;
				const lastContact = contact?.contact_history?.[0]?.date;

				if (!lastContact) return true;

				const daysSinceContact = Math.floor((now - new Date(lastContact)) / (1000 * 60 * 60 * 24));
				return daysSinceContact > 30; // Default to monthly check
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
				totalActive: contacts.length,
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
