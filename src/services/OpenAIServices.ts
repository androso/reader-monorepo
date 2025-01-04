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
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Answer the question based on the provided context.' },
        { role: 'user', content: `Context:\n${context}\n\nQuestion: ${query}\n\nAnswer:` }
      ],
      temperature: 0.7,
      max_tokens: 300
    });

    return response.choices[0].message.content || '';
  }

   // New method specifically for analyzing text chunks
   async analyzeChunks(chunks: string[]): Promise<number[]> {
    console.log('[OpenAIService] Starting chunk analysis');
    console.log(`[OpenAIService] Analyzing ${chunks.length} chunks`);
    
    try {
      if (!chunks.length) {
        console.log('[OpenAIService] No chunks to analyze');
        return [];
      }
      
      const chunkedText = chunks.map((chunk, index) => 
        `Chunk ${index + 1}:\n${chunk}\n---\n`
      ).join('\n');

      console.log('[OpenAIService] Sending request to OpenAI');
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Analyze the following text chunks and identify natural semantic breaks...`
          },
          {
            role: 'user',
            content: chunkedText
          }
        ],
        temperature: 0.3,
        max_tokens: 200
      });

      console.log('[OpenAIService] Received response from OpenAI');
      const result = response.choices[0]?.message?.content || '';
      console.log(`[OpenAIService] Raw response: ${result}`);
      
      const splits = result.toLowerCase().includes('split_after:') 
        ? result
            .split('split_after:')[1]
            .match(/\d+/g)
            ?.map(num => parseInt(num))
            .filter(num => !isNaN(num) && num <= chunks.length) || []
        : [];
      
      console.log(`[OpenAIService] Parsed split points: ${splits.join(', ')}`);
      return splits;
    } catch (error) {
      console.error('[OpenAIService] Error analyzing chunks:', error);
      return [];
    }
  }
}