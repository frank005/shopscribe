// Subtitle Cleaning Utility
// Strips bracketed tags from ASR/assistant text for clean display

/**
 * Clean subtitle text by removing bracketed tags
 * @param {string} text - Raw subtitle text
 * @returns {string} - Cleaned text for display
 */
export function cleanSubtitleText(text) {
  if (!text || typeof text !== 'string') {
    return text || '';
  }

  // Remove bracketed product tags: [[field:value]]
  let cleaned = text.replace(/\[\[(\w+):\s*[^\]]+\]\]/g, '');
  
  // Remove any remaining double brackets that might be malformed
  cleaned = cleaned.replace(/\[\[[^\]]*\]\]/g, '');
  
  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  
  return cleaned;
}

/**
 * Check if text contains any bracketed tags
 * @param {string} text - Text to check
 * @returns {boolean} - True if tags are found
 */
export function hasBracketedTags(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  return /\[\[[^\]]+\]\]/.test(text);
}

/**
 * Extract tags from text without removing them
 * @param {string} text - Text to extract tags from
 * @returns {Array} - Array of found tags
 */
export function extractTags(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  const tagPattern = /\[\[(\w+):\s*([^\]]+)\]\]/g;
  const tags = [];
  let match;
  
  while ((match = tagPattern.exec(text)) !== null) {
    tags.push({
      field: match[1],
      value: match[2].trim()
    });
  }
  
  return tags;
}
