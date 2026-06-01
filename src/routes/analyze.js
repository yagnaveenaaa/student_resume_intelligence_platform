import { Router } from 'express';
import { uploadResume } from '../middleware/upload.js';
import { extractTextFromPdf } from '../services/pdf.js';
import { analyzeResume } from '../services/gemini.js';

export const analyzeRouter = Router();

analyzeRouter.post('/', (req, res, next) => {
  uploadResume(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a PDF file in the "resume" field.' });
    }

    const targetRole = req.body?.targetRole?.trim() || '';
    const jobDescription = req.body?.jobDescription?.trim() || '';

    if (!targetRole) {
      return res.status(400).json({ error: 'Please enter a target role (e.g. Software Engineer Intern).' });
    }

    try {
      const resumeText = await extractTextFromPdf(req.file.buffer);
      const report = await analyzeResume(resumeText, { targetRole, jobDescription });

      return res.json(report);
    } catch (error) {
      next(error);
    }
  });
});
