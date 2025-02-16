export const formatBirthday = (birthday) => {
	if (!birthday) return null;

	try {
		// Handle strings (if already in MM-DD format)
		if (typeof birthday === 'string' && /^\d{2}-\d{2}$/.test(birthday)) {
			return birthday;
		}

		// Handle iOS contact birthday object
		if (typeof birthday === 'object') {
			// If it's a Date object
			if (birthday instanceof Date) {
				if (!isNaN(birthday.getTime())) {
					return `${String(birthday.getMonth() + 1).padStart(2, '0')}-${String(birthday.getDate()).padStart(
						2,
						'0'
					)}`;
				}
				return null;
			}

			// Handle iOS contact birthday object
			const { month, day } = birthday;
			if (month !== undefined && day !== undefined) {
				return `${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
			}
		}
	} catch (error) {
		console.error('Error formatting birthday:', error);
	}

	return null;
};

export const parseBirthday = (birthday) => {
	if (!birthday) return null;

	try {
		// Handle MM-DD format
		const [month, day] = birthday.split('-').map(Number);
		if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
			return {
				month: month - 1, // Convert to 0-based month
				day,
			};
		}
	} catch (e) {
		console.error('Error parsing birthday:', e);
	}

	return null;
};

export const formatBirthdayDisplay = (birthday) => {
	if (!birthday) return '';

	try {
		const parsed = parseBirthday(birthday);
		if (!parsed) return '';

		const months = [
			'January',
			'February',
			'March',
			'April',
			'May',
			'June',
			'July',
			'August',
			'September',
			'October',
			'November',
			'December',
		];

		return `${months[parsed.month]} ${parsed.day}`;
	} catch (error) {
		console.error('Error formatting birthday display:', error);
		return '';
	}
};
