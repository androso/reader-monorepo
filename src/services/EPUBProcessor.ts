// src/services/EPUBProcessor.ts
import { S3Service } from './S3Services';
import { ChromaService } from './ChromaService';
import { OpenAIService } from './OpenAIServices';
import { readFile } from 'fs/promises';
import EPub from 'epub';
import { JSDOM } from 'jsdom';
import { QueryResponse } from '../types';
import * as path from 'path';
import { unlink } from 'fs/promises';

export class EPUBProcessor {
  // Define services
  private s3Service: S3Service;
  private chromaService: ChromaService;
  private openAIService: OpenAIService;
  private localFilePath: string;

  constructor(bucketName: string) {
    // Initialize services
    this.s3Service = new S3Service(bucketName);
    this.chromaService = new ChromaService();
    this.openAIService = new OpenAIService();
    this.localFilePath = path.join(__dirname, '../../temp_epub_file.epub');
  }

  private async extractTextFromEpub(): Promise<string[]> {
    // Extract text from EPUB file
    return new Promise((resolve, reject) => {
      // Initialize EPUB parser
      const epub = new EPub(this.localFilePath);
      // Handle errors during parsing and reading chapters
      epub.on('end', async () => {
        try {
          // Extract text from chapters and split into chunks for ChromaDB indexing
          const chapters: string[] = [];
          
          // Get all chapters
          for(let i = 0; i < epub.flow.length; i++) {
            // Read chapter text from EPUB
            const chapter = await new Promise<string>((resolveChapter) => {
              // Read chapter text
              epub.getChapter(epub.flow[i].id, (error: Error, text: string) => {
                // Handle errors and parse HTML text
                if (error) {
                  console.error(`Error reading chapter ${i}:`, error);
                  resolveChapter(''); // Skip problematic chapters
                } else {
                  // Parse HTML and extract text
                  const dom = new JSDOM(text);
                  // Extract text content from chapter HTML
                  const textContent = dom.window.document.body.textContent || '';
                  // Resolve chapter text content or empty string
                  resolveChapter(textContent);
                }
              });
            });

            if (chapter.trim()) {
              // Split into chunks of roughly 1000 characters
              let currentChunk = '';
              // Split chapter text into words and add to chunks
              const words = chapter.split(/\s+/);
              // Split into chunks of roughly 1000 characters (ChromaDB limit) 
              for (const word of words) {
                // Check if adding word to current chunk exceeds limit
                if ((currentChunk + ' ' + word).length < 1000) {
                  // Add word to current chunk 
                  currentChunk += (currentChunk ? ' ' : '') + word;
                  // Skip to next word if current chunk is not full 
                } else {
                  if (currentChunk) {
                    // Add current chunk to list of chapters 
                    chapters.push(currentChunk.trim());
                  }
                  // Start new chunk with current word
                  currentChunk = word;
                }
              }
              // Add last chunk if not empty 
              if (currentChunk) {
                chapters.push(currentChunk.trim());
              }
            }
          }
          // Resolve with extracted chapters 
          resolve(chapters);
        } catch (error) {
          reject(error);
        }
      });
      // Parse EPUB file 
      epub.parse();
    });
  }

  // Process EPUB file and add to ChromaDB collection 
  private async processEpub(collectionName: string): Promise<boolean> {
    try {
      // Extract text from EPUB file
      const chunks = await this.extractTextFromEpub();
      
      // Validate chunks
      const validChunks = chunks
      // Filter out empty or large chunks 
          .filter(chunk => chunk && chunk.length > 0)
      // Filter out large chunks 
          .map(chunk => chunk.slice(0, 8000)); // ChromaDB limit
          
      console.log({
          totalChunks: chunks.length,
          validChunks: validChunks.length,
          averageChunkLength: validChunks.reduce((acc, chunk) => acc + chunk.length, 0) / validChunks.length
      });

      // Check if any valid chunks were extracted
      if (!validChunks.length) {
          throw new Error('No valid text chunks extracted');
      }

      // Add documents to ChromaDB collection 
      await this.chromaService.addDocuments(collectionName, validChunks);
      return true;
    } catch (error) {
      console.error('Error processing EPUB:', error);
      return false;
    }
  }

  // Process EPUB file and query ChromaDB collection
  async processAndQuery(
    epubKey: string,
    collectionName: string,
    query: string
  ): Promise<QueryResponse> {
    try {
      // Check if collection exists by trying to query it
      try {
        // Query collection to check if it exists and has documents
        const results = await this.chromaService.queryCollection(collectionName, query);
        if (results.documents[0]?.length) {
          // Collection exists and has documents, proceed with query
          const context = results.documents[0].join('\n\n');
          // Generate response using OpenAI
          const answer = await this.openAIService.generateResponse(context, query);
          
          // Return response and source documents
          return {
            answer,
            source_documents: results.documents[0].filter((doc): doc is string => doc !== null)
          };
        }
      } catch (error) {
        // Collection doesn't exist or is empty, proceed with processing
        console.log('Collection not found or empty, processing EPUB...');
      }

      // Download and process EPUB
      const downloaded = await this.s3Service.downloadFile(epubKey, this.localFilePath);
      if (!downloaded) {
        return { error: 'Failed to download EPUB file' };
      }else{
        console.log('Downloaded EPUB file');
      }

      // Process EPUB file and add to collection
      const processed = await this.processEpub(collectionName);
      if (!processed) {
        return { error: 'Failed to process EPUB file' };
      }

      // Query the newly processed collection
      const results = await this.chromaService.queryCollection(collectionName, query);
      const context = results.documents[0].join('\n\n');
      const answer = await this.openAIService.generateResponse(context, query);

      // Cleanup temporary file
      try {
        await unlink(this.localFilePath);
      } catch (error) {
        console.error('Error deleting temporary file:', error);
      }

      // Return response and source documents
      return {
        answer,
        source_documents: results.documents[0].filter((doc): doc is string => doc !== null)
      };

    } catch (error) {
      console.error('Error in processAndQuery:', error);
      if (error instanceof Error) {
        return { error: error.message || 'An error occurred during processing' };
      } else {
        return { error: 'An unknown error occurred during processing' };
      }
    }
  }
}