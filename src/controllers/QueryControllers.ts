// src/controllers/QueryController.ts
import { Request, Response } from 'express';
import { ProcessQueryRequest, QueryResponse } from '../types';
import { EPUBProcessor } from '../services/EPUBProcessor';
import { DeleteCollectionResponse } from '../types';

// Define QueryController class
export class QueryController {
  private epubProcessor: EPUBProcessor;

  // Initialize EPUBProcessor with bucket name
  constructor(bucketName: string) {
    this.epubProcessor = new EPUBProcessor(bucketName);
  }

  // Define query handler function for Express route handler
  async handleQuery(req: Request<{}, {}, ProcessQueryRequest>, res: Response<QueryResponse>) {
    try {
      const { fileKey, collectionName, query } = req.body;
      const result = await this.epubProcessor.processAndQuery(fileKey, collectionName, query);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: `Server error: ${error}` });
    }
  }

  async handleDelete(req: Request, res: Response<DeleteCollectionResponse>) {
    try {
      const { collectionName } = req.params;
      
      if (!collectionName) {
        res.status(400).json({ 
          success: false, 
          error: 'Collection name is required' 
        });
        return;
      }
  
      await this.epubProcessor.deleteCollection(collectionName);
      
      res.json({ 
        success: true, 
        message: `Collection ${collectionName} deleted successfully` 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}