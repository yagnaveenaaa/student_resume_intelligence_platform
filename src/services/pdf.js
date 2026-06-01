import pdf from 'pdf-parse';

/**
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
export async function extractTextFromPdf(buffer) {
  const { text } = await pdf(buffer);
  const normalized = text?.replace(/\s+/g, ' ').trim() ?? '';

  if (!normalized) {
    throw new Error('No text could be extracted from the PDF. Try a text-based PDF, not a scanned image.');
  }

  return normalized;
}
