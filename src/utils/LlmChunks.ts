import { OpenAIService } from "../services/OpenAIServices";

export class LLMChunker {
  private openAIService: OpenAIService;
  private defaultChunkSize = 1000;
  private minkChunkSize = 100;

  constructor() {
    this.openAIService = new OpenAIService();
  }

  private createInitialChunks(text: string): string[] {
    const chunks: string[] = [];
    const words = text.split(/\s+/);
    let currentChunk = '';

    for (const word of words) {
      if ((currentChunk + ' ' + word).length < this.minkChunkSize) {
        currentChunk += (currentChunk ? ' ' : '') + word;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = word;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Main method to chunk text using LLM analysis
   */
  async chunkText(text: string): Promise<string[]> {
    try {
      // Create initial chunks
      const initialChunks = this.createInitialChunks(text);
      if (initialChunks.length <= 1) return initialChunks;

      const finalChunks: string[] = [];
      let currentChunkIndex = 0;
      
      while (currentChunkIndex < initialChunks.length) {
        // Take a window of chunks for analysis
        const windowSize = Math.min(10, initialChunks.length - currentChunkIndex);
        const chunksToAnalyze = initialChunks.slice(
          currentChunkIndex, 
          currentChunkIndex + windowSize
        );

        // Get split points from LLM
        const splitPoints = await this.openAIService.analyzeChunks(chunksToAnalyze);
        
        if (splitPoints.length === 0) {
          // If no splits suggested, keep the window as one chunk
          finalChunks.push(chunksToAnalyze.join(' '));
          currentChunkIndex += windowSize;
        } else {
          // Process the splits
          let lastSplit = 0;
          for (const splitPoint of splitPoints) {
            const chunkText = chunksToAnalyze
              .slice(lastSplit, splitPoint)
              .join(' ');
            if (chunkText.trim()) {
              finalChunks.push(chunkText);
            }
            lastSplit = splitPoint;
          }
          
          // Add remaining text from window if any
          if (lastSplit < chunksToAnalyze.length) {
            const remainingText = chunksToAnalyze
              .slice(lastSplit)
              .join(' ');
            if (remainingText.trim()) {
              finalChunks.push(remainingText);
            }
          }
          
          currentChunkIndex += windowSize;
        }
      }

      // Filter out any chunks that are too small
      return finalChunks
        .map(chunk => chunk.trim())
        .filter(chunk => chunk.length >= this.minkChunkSize);

    } catch (error) {
      console.error('Error in LLM chunking:', error);
      // Fallback to basic chunking if LLM analysis fails
      return this.createInitialChunks(text);
    }
  }
}
