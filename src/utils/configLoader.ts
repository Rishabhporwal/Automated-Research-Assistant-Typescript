import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { Logger } from './logger';
import { ResearchAnalystException } from './exceptions';

const logger = new Logger('ConfigLoader');

export class ConfigLoader {
  private config: Record<string, any>;

  constructor(configPath?: string) {
    this.config = this.loadConfig(configPath);
  }

  private projectRoot(): string {
    return path.resolve(__dirname, '../..');
  }

  private loadConfig(configPath?: string): Record<string, any> {
    try {
      const envPath = process.env.CONFIG_PATH;
      
      // Step 1: Resolve effective path
      if (!configPath) {
        configPath = envPath || path.join(this.projectRoot(), 'config', 'configuration.yaml');
      }

      const absolutePath = path.isAbsolute(configPath) 
        ? configPath 
        : path.join(this.projectRoot(), configPath);

      // Step 2: Validate existence
      if (!fs.existsSync(absolutePath)) {
        logger.error('Configuration file not found', { path: absolutePath });
        throw new Error(`Config file not found: ${absolutePath}`);
      }

      // Step 3: Load YAML
      const fileContent = fs.readFileSync(absolutePath, 'utf8');
      const config = yaml.parse(fileContent) || {};

      // Step 4: Log config summary
      const topKeys = Object.keys(config);
      logger.info('Configuration loaded successfully', { path: absolutePath, keys: topKeys });

      return config;

    } catch (error: any) {
      logger.error('Error loading configuration', { error: error.message });
      throw new ResearchAnalystException('Failed to load configuration file', error);
    }
  }

  get(key: string, defaultValue?: any): any {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  }

  getEmbeddingConfig() {
    return this.get('embedding_model', {});
  }

  getLLMConfig() {
    return this.get('llm', {});
  }

  getProviderConfig(provider: string) {
    const llmConfig = this.getLLMConfig();
    return llmConfig[provider] || {};
  }

  getAll(): Record<string, any> {
    return { ...this.config };
  }
}