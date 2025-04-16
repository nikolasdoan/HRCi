import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Configuration interface for Gemini
interface GeminiConfig {
  apiKey: string;
  model: string;
}

// Default configuration
const defaultConfig: GeminiConfig = {
  apiKey: process.env.GOOGLE_GENAI_API_KEY || '',
  model: 'googleai/gemini-2.0-flash',
};

// Create AI instance with enhanced configuration
export const ai = genkit({
  promptDir: './prompts',
  plugins: [
    googleAI({
      apiKey: defaultConfig.apiKey,
      models: [defaultConfig.model],
    }),
  ],
  model: defaultConfig.model,
});

// Export configuration for external use
export const geminiConfig = defaultConfig;
