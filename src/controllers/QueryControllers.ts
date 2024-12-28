// src/controllers/QueryController.ts
import { Request, Response } from 'express';
import { ProcessQueryRequest, QueryResponse } from '../types';
import { EPUBProcessor } from '../services/EPUBProcessor';

export class QueryController {
  private epubProcessor: EPUBProcessor;

  constructor(bucketName: string) {
    this.epubProcessor = new EPUBProcessor(bucketName);
  }

  async handleQuery(req: Request<{}, {}, ProcessQueryRequest>, res: Response<QueryResponse>) {
    try {
      const { fileKey, collectionName, query } = req.body;
      const result = await this.epubProcessor.processAndQuery(fileKey, collectionName, query);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: `Server error: ${error}` });
    }
  }
}