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
  private s3Service: S3Service;
  private chromaService: ChromaService;
  private openAIService: OpenAIService;
  private localFilePath: string;

  constructor(bucketName: string) {
    this.s3Service = new S3Service(bucketName);
    this.chromaService = new ChromaService();
    this.openAIService = new OpenAIService();
    this.localFilePath = path.join(__dirname, '../../temp_epub_file.epub');
  }

  private async extractTextFromEpub(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const epub = new EPub(this.localFilePath);

      epub.on('end', async () => {
        try {
          const chapters: string[] = [];
          
          // Get all chapters
          for(let i = 0; i < epub.flow.length; i++) {
            const chapter = await new Promise<string>((resolveChapter) => {
              epub.getChapter(epub.flow[i].id, (error: Error, text: string) => {
                if (error) {
                  console.error(`Error reading chapter ${i}:`, error);
                  resolveChapter(''); // Skip problematic chapters
                } else {
                  // Parse HTML and extract text
                  const dom = new JSDOM(text);
                  const textContent = dom.window.document.body.textContent || '';
                  resolveChapter(textContent);
                }
              });
            });

            if (chapter.trim()) {
              // Split into chunks of roughly 1000 characters
              let currentChunk = '';
              const words = chapter.split(/\s+/);
              
              for (const word of words) {
                if ((currentChunk + ' ' + word).length < 1000) {
                  currentChunk += (currentChunk ? ' ' : '') + word;
                } else {
                  if (currentChunk) {
                    chapters.push(currentChunk.trim());
                  }
                  currentChunk = word;
                }
              }
              
              if (currentChunk) {
                chapters.push(currentChunk.trim());
              }
            }
          }
          
          resolve(chapters);
        } catch (error) {
          reject(error);
        }
      });

      epub.parse();
    });
  }

  private async processEpub(collectionName: string): Promise<boolean> {
    try {
      const chunks = await this.extractTextFromEpub();
      
      // Validate chunks
      const validChunks = chunks
          .filter(chunk => chunk && chunk.length > 0)
          .map(chunk => chunk.slice(0, 8000)); // ChromaDB limit
          
      console.log({
          totalChunks: chunks.length,
          validChunks: validChunks.length,
          averageChunkLength: validChunks.reduce((acc, chunk) => acc + chunk.length, 0) / validChunks.length
      });

      if (!validChunks.length) {
          throw new Error('No valid text chunks extracted');
      }

      await this.chromaService.addDocuments(collectionName, validChunks);
      return true;
    } catch (error) {
      console.error('Error processing EPUB:', error);
      return false;
    }
  }

  async processAndQuery(
    epubKey: string,
    collectionName: string,
    query: string
  ): Promise<QueryResponse> {
    try {
      // Check if collection exists by trying to query it
      try {
        const results = await this.chromaService.queryCollection(collectionName, query);
        if (results.documents[0]?.length) {
          // Collection exists and has documents, proceed with query
          const context = results.documents[0].join('\n\n');
          const answer = await this.openAIService.generateResponse(context, query);
          
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