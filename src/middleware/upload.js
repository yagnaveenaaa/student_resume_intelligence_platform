import multer from 'multer';
import { config } from '../config/index.js';

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

export const uploadResume = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 },
}).single('resume');
