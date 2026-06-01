import 'dotenv/config';

const required = ['GEMINI_API_KEY'];

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`Warning: ${key} is not set. Copy .env.example to .env and add your key.`);
  }
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB) || 5,
};
