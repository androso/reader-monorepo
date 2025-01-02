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

  //generate response function to generate response from the model based on the context and query
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

   // New method specifically for analyzing text chunks
   async analyzeChunks(chunks: string[]): Promise<number[]> {
    const chunkedText = chunks.map((chunk, index) => 
      `<|start_chunk_${index + 1}|>${chunk}<|end_chunk_${index + 1}|>`
    ).join('\n');

    const response = await this.client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a text analysis system that identifies natural semantic breaks in text.
Your task is to analyze the provided chunks and determine where thematic breaks occur.
You must respond ONLY with the chunk numbers where splits should occur, in the format:
split_after: X, Y, Z

Example response:
split_after: 3, 7, 12

DO NOT include any other text or explanations in your response.`
        },
        {
          role: 'user',
          content: chunkedText
        }
      ],
      temperature: 0.2, // Lower temperature for more consistent responses
      max_tokens: 100   // Reduced as we only need numbers
    });

    const result = response.choices[0].message.content || '';
    
    // Parse the response to extract numbers
    const splitMatch = result.match(/split_after:\s*([\d,\s]+)/);
    if (!splitMatch) return [];
    
    return splitMatch[1]
      .split(',')
      .map(num => parseInt(num.trim()))
      .filter(num => !isNaN(num));
  }
}