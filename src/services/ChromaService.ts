import { ChromaClient, OpenAIEmbeddingFunction } from "chromadb";
import dotenv from "dotenv";

dotenv.config();

export class ChromaService {
  private client: ChromaClient;
  private embeddingFunction: OpenAIEmbeddingFunction;
  private collections: Map<string, string> = new Map();

  constructor() {
    this.client = new ChromaClient({
      path: process.env.CHROMA_URL || "http://localhost:8000",
      auth: {
        provider: "basic",
        credentials: process.env.CHROMA_CLIENT_AUTH_CREDENTIALS || "",
      },
    });
    //test connection
    //this.testConnection();

    this.embeddingFunction = new OpenAIEmbeddingFunction({
      openai_api_key: process.env.OPENAI_API_KEY || "",
      openai_model: "text-embedding-ada-002",
    });
  }
  //test connection function
  private async testConnection() {
    try {
      await this.client.heartbeat();
      let collection = await this.client.listCollections();
      console.log("ChromaDB Connection: OK");
    } catch (error) {
      console.error("ChromaDB Connection Failed:", error);
    }
  }

  async getOrCreateCollection(name: string) {
    try {
        let collection;
        // First try to get existing collection
        try {
            collection = await this.client.getCollection({
                name,
                embeddingFunction: this.embeddingFunction,
            });
            console.log(`Found collection: ${name} with ID: ${collection.id}`);
        } catch (error) {
            collection = await this.client.createCollection({
                name,
                embeddingFunction: this.embeddingFunction,
            });
            console.log(`Created collection: ${name} with ID: ${collection.id}`);
        }
        
        this.collections.set(name, collection.id);
        return collection;
    } catch (error) {
        console.error('Error in getOrCreateCollection:', error);
        throw error;
    }
  }

  async addDocuments(collectionName: string, documents: string[]) {
    try {
        const collection = await this.getOrCreateCollection(collectionName);
        console.log(`Using collection: ${collectionName} with ID: ${collection.id}`);
        
        const BATCH_SIZE = 5; // Reduced further
        
        for (let i = 0; i < documents.length; i += BATCH_SIZE) {
            const batch = documents.slice(i, i + BATCH_SIZE);
            const validBatch = batch.filter(doc => 
                doc && 
                doc.length > 0 && 
                doc.length < 4000 // Reduced size limit
            );

            if (validBatch.length > 0) {
                const batchData = {
                    ids: validBatch.map((_, idx) => `doc_${Date.now()}_${i + idx}`),
                    documents: validBatch,
                    metadatas: validBatch.map(() => ({ timestamp: Date.now() })),
                };

                console.log(`Adding batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(documents.length/BATCH_SIZE)}`);
                await collection.add(batchData);
                await new Promise(resolve => setTimeout(resolve, 500)); // Increased delay
            }
        }
    } catch (error) {
        console.error("ChromaDB Add Error:", {
            collectionName,
            collectionId: this.collections.get(collectionName),
            batchInfo: { total: documents.length, first: documents[0]?.length },
            error: error instanceof Error ? error.stack : String(error)
        });
        throw error;
    }
  }

  async queryCollection(collectionName: string, query: string, nResults = 3) {
    const collection = await this.getOrCreateCollection(collectionName);
    return await collection.query({
      queryTexts: [query],
      nResults,
    });
  }
}
