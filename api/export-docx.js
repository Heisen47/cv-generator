import { Packer } from 'docx';
import { markdownToDocxDocument } from './docx-builder.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const markdown = body.markdown || '';

    if (!markdown || markdown.trim().length < 10) {
      return res.status(400).json({ status: 'error', message: 'Markdown content is required.' });
    }

    const docxDoc = markdownToDocxDocument(markdown);
    const docxBuffer = await Packer.toBuffer(docxDoc);
    const docxBase64 = docxBuffer.toString('base64');

    return res.status(200).json({ status: 'success', docxBase64 });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
