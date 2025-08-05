"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class ConfigManager {
    constructor() {
        this.configPath = path.join(os.homedir(), ".lsp-top", "aliases.json");
        this.config = this.loadConfig();
    }
    validateConfigShape(obj) {
        if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
            throw new Error("Invalid config: expected object mapping alias to path");
        }
        for (const [k, v] of Object.entries(obj)) {
            if (typeof k !== "string" || typeof v !== "string") {
                throw new Error("Invalid config: aliases must map to string paths");
            }
        }
    }
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, "utf-8");
                const parsed = JSON.parse(data);
                this.validateConfigShape(parsed);
                return parsed;
            }
        }
        catch (error) {
            console.error("Error loading config:", error);
        }
        return {};
    }
    saveConfig() {
        const dir = path.dirname(this.configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    }
    addAlias(alias, projectPath) {
        const absolutePath = path.resolve(projectPath);
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`Path does not exist: ${absolutePath}`);
        }
        this.config[alias] = absolutePath;
        this.validateConfigShape(this.config);
        this.saveConfig();
    }
    getPath(alias) {
        return this.config[alias];
    }
    removeAlias(alias) {
        if (this.config[alias]) {
            delete this.config[alias];
            this.saveConfig();
            return true;
        }
        return false;
    }
    listAliases() {
        return { ...this.config };
    }
    effectiveConfig(envKeys = []) {
        const env = {};
        for (const key of envKeys)
            env[key] = process.env[key];
        return { aliases: this.listAliases(), env };
    }
}
exports.ConfigManager = ConfigManager;
