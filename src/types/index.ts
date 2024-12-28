export interface ProcessQueryRequest {
  fileKey: string;
  collectionName: string;
  query: string;
}

export interface QueryResponse {
  answer?: string;
  source_documents?: string[];
  error?: string;
}
