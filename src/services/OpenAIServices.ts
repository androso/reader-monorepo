import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async generateResponse(context: string, query: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Answer the question based on the provided context.' },
        { role: 'user', content: `Context:\n${context}\n\nQuestion: ${query}\n\nAnswer:` }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return response.choices[0].message.content || '';
  }
}