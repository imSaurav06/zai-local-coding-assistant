/**
 * Formats an ISO date string or Date object into a readable date string.
 * E.g., "Jul 7, 2026, 7:30 PM"
 * @param {string|Date} dateVal 
 * @returns {string}
 */
export const formatDate = (dateVal) => {
  if (!dateVal) return '';
  const date = new Date(dateVal);
  if (isNaN(date.getTime())) return '';
  
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};
