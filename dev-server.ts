import { join } from 'path';
import { Packer } from 'docx';
import { processOptimization } from './api/optimize.js';
import { markdownToDocxDocument } from './api/docx-builder.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const WEB_DIR = join(import.meta.dir, 'web');

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    // API Route
    if (url.pathname === '/api/optimize') {
      if (req.method !== 'POST') {
        return Response.json({ status: 'error', message: 'Method not allowed' }, { status: 405 });
      }

      try {
        let body: any;
        try {
          body = await req.json();
        } catch {
          const raw = await req.text();
          body = JSON.parse(raw);
        }
        const { cvText, jobDescription, targetRole } = body || {};

        if (!cvText || cvText.trim().length < 30) {
          return Response.json({ status: 'error', message: 'CV text is required (min 30 chars).' }, { status: 400 });
        }
        if (!jobDescription || jobDescription.trim().length < 30) {
          return Response.json({ status: 'error', message: 'Job description is required (min 30 chars).' }, { status: 400 });
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey || apiKey === 'gsk_your_groq_api_key_here') {
          return Response.json({
            status: 'error',
            message: 'GROQ_API_KEY is not set in .env. Please add your Groq API key.'
          }, { status: 500 });
        }

        const data = await processOptimization({ cvText, jobDescription, targetRole, apiKey });
        return Response.json({ status: 'success', data }, {
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      } catch (err: any) {
        return Response.json({ status: 'error', message: err.message }, { status: 500 });
      }
    }

    // DOCX Export Route for Live Edited Content
    if (url.pathname === '/api/export-docx') {
      if (req.method !== 'POST') {
        return Response.json({ status: 'error', message: 'Method not allowed' }, { status: 405 });
      }
      try {
        let body: any;
        try {
          body = await req.json();
        } catch {
          body = JSON.parse(await req.text());
        }
        const markdown = body.markdown || '';
        const docxDoc = markdownToDocxDocument(markdown);
        const docxBuffer = await Packer.toBuffer(docxDoc);
        return Response.json({ status: 'success', docxBase64: docxBuffer.toString('base64') }, {
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      } catch (err: any) {
        return Response.json({ status: 'error', message: err.message }, { status: 500 });
      }
    }

    // Vercel Insights local stub (no-op in local dev)
    if (url.pathname.startsWith('/_vercel/insights')) {
      return new Response('/* Vercel analytics local dev stub */', {
        headers: { 'Content-Type': 'application/javascript' }
      });
    }

    // Serve Static Files from /web
    let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
    let target = join(WEB_DIR, filePath);
    let file = Bun.file(target);

    if (await file.exists()) {
      return new Response(file);
    }

    // Fallback to index.html for SPA routing
    return new Response(Bun.file(join(WEB_DIR, 'index.html')));
  }
});

console.log(`CV Optimizer dev server running at http://localhost:${server.port}`);
