import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, ExternalHyperlink } from 'docx';

export function markdownToDocxDocument(markdown) {
  const lines = markdown.split('\n');
  const children = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trimEnd();
    if (!rawLine.trim()) {
      children.push(new Paragraph({ text: '' }));
      continue;
    }

    // Title (# Name)
    if (rawLine.startsWith('# ')) {
      const text = rawLine.replace(/^#\s+/, '').trim();
      children.push(new Paragraph({
        text: text.toUpperCase(),
        alignment: AlignmentType.CENTER,
        heading: HeadingLevel.TITLE,
        spacing: { after: 120 }
      }));
      continue;
    }

    // Section Header (## Section)
    if (rawLine.startsWith('## ')) {
      const text = rawLine.replace(/^##\s+/, '').trim();
      children.push(new Paragraph({
        text: text.toUpperCase(),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
        border: {
          bottom: { color: '333333', space: 1, style: 'single', size: 6 }
        }
      }));
      continue;
    }

    // Sub-item Header (### Role/Company)
    if (rawLine.startsWith('### ')) {
      const text = rawLine.replace(/^###\s+/, '').trim();
      children.push(new Paragraph({
        children: parseInlineFormatting(text),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 140, after: 60 }
      }));
      continue;
    }

    // Bullet points (- Bullet or * Bullet)
    if (/^\s*[-*]\s+/.test(rawLine)) {
      const bulletText = rawLine.replace(/^\s*[-*]\s+/, '').trim();
      children.push(new Paragraph({
        children: parseInlineFormatting(bulletText),
        bullet: { level: 0 },
        spacing: { before: 40, after: 40 }
      }));
      continue;
    }

    // Regular paragraph
    children.push(new Paragraph({
      children: parseInlineFormatting(rawLine),
      spacing: { before: 40, after: 60 }
    }));
  }

  return new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 720,    // 0.5 inch
            right: 720,
            bottom: 720,
            left: 720
          }
        }
      },
      children
    }]
  });
}

// Parse markdown bold, italic, and links into docx TextRuns and ExternalHyperlinks
function parseInlineFormatting(text) {
  const elements = [];
  // Regex to match [link](url), **bold**, *italic*
  const tokenRegex = /(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(new TextRun({ text: text.slice(lastIndex, match.index) }));
    }

    if (match[1]) {
      // Hyperlink [text](url)
      const linkText = match[2];
      const linkUrl = match[3];
      elements.push(new ExternalHyperlink({
        children: [
          new TextRun({
            text: linkText,
            color: '0066CC',
            underline: { type: 'single' }
          })
        ],
        link: linkUrl
      }));
    } else if (match[4]) {
      // Bold **text**
      elements.push(new TextRun({ text: match[5], bold: true }));
    } else if (match[6]) {
      // Italic *text*
      elements.push(new TextRun({ text: match[7], italics: true }));
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(new TextRun({ text: text.slice(lastIndex) }));
  }

  return elements.length > 0 ? elements : [new TextRun({ text })];
}
