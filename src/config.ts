import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ProjectConfig {
  [alias: string]: string;
}

export interface EffectiveConfig {
  aliases: ProjectConfig;
  env: Record<string, string | undefined>;
}

export class ConfigManager {
  private configPath: string;
  private config: ProjectConfig;

  constructor() {
    this.configPath = path.join(os.homedir(), '.lsp-top', 'aliases.json');
    this.config = this.loadConfig();
  }

  private validateConfigShape(obj: unknown): asserts obj is ProjectConfig {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('Invalid config: expected object mapping alias to path');
    }
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof k !== 'string' || typeof v !== 'string') {
        throw new Error('Invalid config: aliases must map to string paths');
      }
    }
  }

  private loadConfig(): ProjectConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(data);
        this.validateConfigShape(parsed);
        return parsed;
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
    return {};
  }

  private saveConfig(): void {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  addAlias(alias: string, projectPath: string): void {
    const absolutePath = path.resolve(projectPath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Path does not exist: ${absolutePath}`);
    }
    this.config[alias] = absolutePath;
    this.validateConfigShape(this.config);
    this.saveConfig();
  }

  getPath(alias: string): string | undefined {
    return this.config[alias];
  }

  removeAlias(alias: string): boolean {
    if (this.config[alias]) {
      delete this.config[alias];
      this.saveConfig();
      return true;
    }
    return false;
  }

  listAliases(): ProjectConfig {
    return { ...this.config };
  }

  effectiveConfig(envKeys: string[] = []): EffectiveConfig {
    const env: Record<string, string | undefined> = {};
    for (const key of envKeys) env[key] = process.env[key];
    return { aliases: this.listAliases(), env };
  }
}