/**
 * Copies text to the system clipboard.
 * @param {string} text 
 * @returns {Promise<boolean>}
 */
export const copyToClipboard = async (text) => {
  if (!navigator.clipboard) {
    // Fallback
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      return successful;
    } catch (err) {
      return false;
    }
  }
  
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    return false;
  }
};
