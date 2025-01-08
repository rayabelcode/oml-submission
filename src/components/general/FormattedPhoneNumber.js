export const formatPhoneNumber = (phone) => {
	if (!phone) return '';
	const cleaned = phone.replace(/\D/g, '');

	if (cleaned.length === 10) {
		return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
	}
	if (cleaned.length === 11 && cleaned.startsWith('1')) {
		return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
	}
	return cleaned;
};

export default formatPhoneNumber;
