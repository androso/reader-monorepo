import { OpenAIService } from "../services/OpenAIServices";

export class LLMChunker {
  private openAIService: OpenAIService;
  private defaultChunkSize = 1000;
  private minChunkSize = 100;  // Fixed typo in variable name
  private maxChunkSize = 8000; // Added max size limit

  constructor() {
    this.openAIService = new OpenAIService();
  }


  private createInitialChunks(text: string): string[] {
    if (!text || text.length < this.minChunkSize) {
      return text ? [text] : [];
    }

    const chunks: string[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunk = '';

    for (const sentence of sentences) {
      const potentialChunk = currentChunk + sentence;
      
      if (potentialChunk.length <= this.defaultChunkSize) {
        currentChunk = potentialChunk;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter(chunk => 
      chunk.length >= this.minChunkSize && 
      chunk.length <= this.maxChunkSize
    );
  }

  async chunkText(text: string): Promise<string[]> {
    console.log('[LLMChunker] Starting text chunking');
    console.log(`[LLMChunker] Input text length: ${text.length}`);
    
    try {
      if (!text || text.length < this.minChunkSize) {
        console.log('[LLMChunker] Text too short, returning as single chunk');
        return text ? [text] : [];
      }

      console.log('[LLMChunker] Creating initial chunks');
      const initialChunks = this.createInitialChunks(text);
      console.log(`[LLMChunker] Created ${initialChunks.length} initial chunks`);
      
      if (initialChunks.length <= 1) {
        console.log('[LLMChunker] Single chunk, no further processing needed');
        return initialChunks;
      }

      const finalChunks: string[] = [];
      let currentChunkIndex = 0;
      
      while (currentChunkIndex < initialChunks.length) {
        const windowSize = Math.min(5, initialChunks.length - currentChunkIndex);
        console.log(`[LLMChunker] Processing window ${currentChunkIndex}-${currentChunkIndex + windowSize}`);
        
        const chunksToAnalyze = initialChunks.slice(
          currentChunkIndex, 
          currentChunkIndex + windowSize
        );

        console.log('[LLMChunker] Requesting LLM analysis');
        const splitPoints = await this.openAIService.analyzeChunks(chunksToAnalyze);
        console.log(`[LLMChunker] Received split points: ${splitPoints.join(', ')}`);
        
        if (!splitPoints.length) {
          const combinedChunk = chunksToAnalyze.join(' ');
          console.log(`[LLMChunker] No split points, combined length: ${combinedChunk.length}`);
          
          if (combinedChunk.length <= this.maxChunkSize) {
            finalChunks.push(combinedChunk);
            console.log('[LLMChunker] Added combined chunk');
          } else {
            finalChunks.push(...chunksToAnalyze);
            console.log('[LLMChunker] Added original chunks due to size limit');
          }
        } else {
          let lastSplit = 0;
          for (const splitPoint of splitPoints) {
            const chunkText = chunksToAnalyze
              .slice(lastSplit, splitPoint)
              .join(' ')
              .trim();
              
            console.log(`[LLMChunker] Processing split chunk length: ${chunkText.length}`);
            if (chunkText && 
                chunkText.length >= this.minChunkSize && 
                chunkText.length <= this.maxChunkSize) {
              finalChunks.push(chunkText);
              console.log('[LLMChunker] Added split chunk');
            }
            lastSplit = splitPoint;
          }
        }
        
        currentChunkIndex += windowSize;
        console.log(`[LLMChunker] Window processed, moving to index ${currentChunkIndex}`);
      }

      console.log(`[LLMChunker] Chunking complete. Final chunks: ${finalChunks.length}`);
      return finalChunks;

    } catch (error) {
      console.error('[LLMChunker] Error:', error);
      console.log('[LLMChunker] Falling back to basic chunking');
      return this.createInitialChunks(text);
    }
  }
}
