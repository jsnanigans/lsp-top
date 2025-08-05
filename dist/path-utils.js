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
exports.resolveProjectPath = resolveProjectPath;
exports.makeRelativeToProject = makeRelativeToProject;
exports.gitChangedFiles = gitChangedFiles;
const path = __importStar(require("path"));
function resolveProjectPath(projectRoot, filePath) {
    if (path.isAbsolute(filePath)) {
        return filePath;
    }
    return path.join(projectRoot, filePath);
}
function makeRelativeToProject(projectRoot, absolutePath) {
    return path.relative(projectRoot, absolutePath);
}
async function gitChangedFiles(projectRoot, opts = {}) {
    const { spawn } = await Promise.resolve().then(() => __importStar(require('child_process')));
    const args = ['git', 'diff', '--name-only'];
    if (opts.staged)
        args.push('--cached');
    return await new Promise((resolve) => {
        const proc = spawn(args[0], args.slice(1), { cwd: projectRoot, stdio: ['ignore', 'pipe', 'ignore'] });
        let out = '';
        proc.stdout?.on('data', (d) => { out += String(d); });
        proc.on('close', () => {
            resolve(out.split('\n').map((s) => s.trim()).filter(Boolean).map((p) => path.join(projectRoot, p)));
        });
    });
}
