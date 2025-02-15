import { fetchUpcomingContacts, fetchContacts } from '../../utils/firestore';
import { RELATIONSHIP_TYPES } from '../../../constants/relationships';

export const calculateStats = async (userId) => {
	try {
		if (!userId) {
			console.error('No userId provided to calculateStats');
			return getDefaultStats();
		}

		const now = new Date();

		// Get all contacts
		const allContactsData = await fetchContacts(userId);
		const allContacts = [...allContactsData.scheduledContacts, ...allContactsData.unscheduledContacts].filter(
			(contact) => contact !== null && !contact.archived
		);

		// Get contacts with scheduling info
		const upcomingContacts = await fetchUpcomingContacts(userId);

		// Calculate distribution by relationship type
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

		// Calculate contacts needing attention
		const getThresholdDays = (frequency) => {
			switch (frequency) {
				case 'daily':
					return 2;
				case 'weekly':
					return 9;
				case 'biweekly':
					return 17;
				case 'monthly':
					return 35;
				case 'quarterly':
					return 95;
				case 'yearly':
					return 370;
				default:
					return 30;
			}
		};

		const needsAttention = upcomingContacts
			.filter((contact) => {
				if (!contact) return false;
				const lastContact = contact?.contact_history?.[0]?.date;
				const frequency = contact?.scheduling?.frequency;

				if (!lastContact) return true;

				const daysSinceContact = Math.floor((now - new Date(lastContact)) / (1000 * 60 * 60 * 24));
				return daysSinceContact > getThresholdDays(frequency);
			})
			.map((contact) => ({
				id: contact.id,
				name: `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim(),
				phone: contact.phone,
				daysOverdue: contact?.contact_history?.[0]?.date
					? Math.floor((now - new Date(contact.contact_history[0].date)) / (1000 * 60 * 60 * 24))
					: Infinity,
				isOverdue: true,
				lastContact: contact?.contact_history?.[0]?.date,
				frequency: contact?.scheduling?.frequency,
			}))
			.sort((a, b) => b.daysOverdue - a.daysOverdue)
			.slice(0, 3);

		return {
			basic: {
				totalActive: allContacts.length, // Total non-archived contacts
				unscheduled: allContacts.filter((contact) => !contact.next_contact).length, // Contacts without next call date
			},
			detailed: {
				needsAttention,
				mostActiveDay: 0,
			},
			distribution,
			trends: {
				ninetyDayTrend: 0,
			},
		};
	} catch (error) {
		console.error('Error calculating stats:', error);
		return getDefaultStats();
	}
};

const getDefaultStats = () => ({
	basic: {
		totalActive: 0,
		unscheduled: 0,
	},
	detailed: {
		needsAttention: [],
		mostActiveDay: 0,
	},
	distribution: [],
	trends: {
		ninetyDayTrend: 0,
	},
});
