import * as dotenv from 'dotenv';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { ChatOllama } from '@langchain/ollama';
import { Logger } from './logger';
import { ResearchAnalystException } from './exceptions';
import { ConfigLoader } from './configLoader';

dotenv.config();

export class ApiKeyManager {
  private apiKeys: Record<string, string | undefined>;

  constructor() {
    this.apiKeys = {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
      GROQ_API_KEY: process.env.GROQ_API_KEY,
      TAVILY_API_KEY: process.env.TAVILY_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    };

    const logger = new Logger('ApiKeyManager');
    logger.info('Initializing ApiKeyManager');

    // Log loaded key statuses without exposing secrets
    Object.entries(this.apiKeys).forEach(([key, val]) => {
      if (val) {
        logger.info(`${key} loaded successfully from environment`);
      } else {
        logger.warn(`${key} is missing in environment variables`); // Changed from warning to warn
      }
    });
  }

  get(key: string): string | undefined {
    return this.apiKeys[key];
  }

  getAll(): Record<string, string | undefined> {
    return { ...this.apiKeys };
  }
}

export class ModelLoader {
  private apiKeyMgr: ApiKeyManager;
  private config: ConfigLoader;
  private logger: Logger;

  constructor() {
    try {
      this.apiKeyMgr = new ApiKeyManager();
      this.config = new ConfigLoader();
      this.logger = new Logger('ModelLoader');
      this.logger.info('YAML configuration loaded successfully');
    } catch (error: any) {
      this.logger.error('Error initializing ModelLoader', { error: error.message });
      throw new ResearchAnalystException('Failed to initialize ModelLoader', error);
    }
  }

  // ----------------------------------------------------------------------
  // 🔹 Embedding Loader
  // ----------------------------------------------------------------------
  async loadEmbeddings(): Promise<GoogleGenerativeAIEmbeddings> {
    try {
      const modelName = this.config.getEmbeddingConfig().model_name || 'models/text-embedding-004';
      this.logger.info('Loading embedding model', { model: modelName });

      const embeddings = new GoogleGenerativeAIEmbeddings({
        model: modelName, // Changed from modelName to model
        apiKey: this.apiKeyMgr.get('GOOGLE_API_KEY'),
      });

      this.logger.info('Embedding model loaded successfully', { model: modelName });
      return embeddings;

    } catch (error: any) {
      this.logger.error('Error loading embedding model', { error: error.message });
      throw new ResearchAnalystException('Failed to load embedding model', error);
    }
  }

  // ----------------------------------------------------------------------
  // 🔹 LLM Loader
  // ----------------------------------------------------------------------
  async loadLLM(): Promise<any> {
    try {
      const providerKey = process.env.LLM_PROVIDER || 'ollama';
      const llmConfig = this.config.getProviderConfig(providerKey);

      if (!llmConfig || Object.keys(llmConfig).length === 0) {
        this.logger.error('LLM provider not found in configuration', { provider: providerKey });
        throw new Error(`LLM provider '${providerKey}' not found in configuration`);
      }

      const provider = llmConfig.provider;
      const modelName = llmConfig.model_name;
      const temperature = llmConfig.temperature || 0.2;
      const baseUrl = llmConfig.base_url;
      const maxTokens = llmConfig.max_output_tokens || 2048;

      this.logger.info('Loading LLM', { provider, model: modelName });

      switch (provider) {
        case 'google':
          return new ChatGoogleGenerativeAI({
            model: modelName, // Changed from modelName to model
            apiKey: this.apiKeyMgr.get('GOOGLE_API_KEY'),
            temperature,
            maxOutputTokens: maxTokens,
          });

        case 'openai':
          return new ChatOpenAI({
            modelName: modelName,
            apiKey: this.apiKeyMgr.get('OPENAI_API_KEY'),
            temperature,
            maxTokens,
          });

        case 'groq':
          // For Groq, use OpenAI-compatible interface
          return new ChatOpenAI({
            modelName: modelName,
            apiKey: this.apiKeyMgr.get('GROQ_API_KEY'),
            temperature,
            maxTokens,
            configuration: {
              baseURL: 'https://api.groq.com/openai/v1',
            },
          });

        case 'ollama':
          return new ChatOllama({
            model: modelName,
            temperature,
            baseUrl: baseUrl || 'http://localhost:11434',
          });

        // case 'anthropic':
        //   // Optional: Add Anthropic support
        //   const { ChatAnthropic } = await import('@langchain/anthropic');
        //   return new ChatAnthropic({
        //     model: modelName,
        //     apiKey: this.apiKeyMgr.get('ANTHROPIC_API_KEY'),
        //     temperature,
        //     maxTokens,
        //   });

        default:
          this.logger.error('Unsupported LLM provider encountered', { provider });
          throw new Error(`Unsupported LLM provider: ${provider}`);
      }

    } catch (error: any) {
      this.logger.error('Error loading LLM', { error: error.message });
      throw new ResearchAnalystException('Failed to load LLM', error);
    }
  }

  // ----------------------------------------------------------------------
  // 🔹 Search Tool Loader
  // ----------------------------------------------------------------------
  async loadSearchTool(): Promise<any> {
    try {
      const apiKey = this.apiKeyMgr.get('TAVILY_API_KEY');
      if (!apiKey) {
        this.logger.warn('TAVILY_API_KEY not found, using mock search');
        return this.createMockSearchTool();
      }

      return {
        invoke: async (query: string) => {
          const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              query,
              search_depth: 'advanced',
              max_results: 5,
              include_answer: false,
              include_raw_content: false
            })
          });

          if (!response.ok) {
            throw new Error(`Tavily API error: ${response.statusText}`);
          }

          const data = await response.json() as any; // Type assertion
          return data.results || [];
        }
      };
    } catch (error: any) {
      this.logger.error('Error loading search tool', { error: error.message });
      return this.createMockSearchTool();
    }
  }

  private createMockSearchTool(): any {
    return {
      invoke: async (query: string) => {
        this.logger.info('Mock search invoked', { query });
        return [
          {
            url: 'https://example.com/source1',
            content: `Mock content for query: "${query}". This is placeholder data. In production, you need a valid Tavily API key.`,
            title: 'Example Source 1',
            score: 0.95
          },
          {
            url: 'https://example.com/source2',
            content: 'Additional mock content demonstrating search functionality.',
            title: 'Example Source 2',
            score: 0.88
          }
        ];
      }
    };
  }
}