# LSP-Top Implementation Plan v4

## Overview

This plan outlines the evolution of LSP-Top from its current MVP state to a comprehensive command-line tool for complex code operations. The tool is **not intended for live coding**, but rather for automation, CI/CD, and AI agent integration.

## Current State Assessment (Updated: January 2025)

### ✅ Production-Ready Features (MVP Complete)

- **Core Infrastructure**: Daemon, LSP client, CLI framework ✅
- **Essential Navigation**: 
  - Definition command (find declarations) ✅
  - References command (find usages) ✅
- **Code Analysis**:
  - File diagnostics with auto-fix ✅
  - Changed files analysis ✅
  - Error detection and correction ✅
- **Safe Transformations**:
  - WorkspaceEdit preview/apply ✅
  - Automated fixes ✅
- **Machine Interface**: Full JSON API with schemas ✅
- **Performance**: <100ms response times ✅
- **Testing**: 26 passing tests, solid infrastructure ✅

### Production Readiness by Use Case

| Use Case | Status | What Works |
|----------|--------|------------|
| **AI Agents** | ✅ READY | Navigate, analyze, apply fixes via JSON |
| **CI/CD** | ✅ READY | Check quality, auto-fix issues |
| **Automation** | ✅ READY | Scriptable operations, fast responses |
| **Human CLI** | ⚠️ PARTIAL | Functional but poor UX |

### 🟡 Enhancement Opportunities (Not Blockers)

- **Extended Navigation**: Type definitions, implementations, symbols
- **Code Understanding**: Hover info, signatures, outlines
- **Refactoring**: Rename, extract functions/variables
- **Search**: Text and symbol search
- **Human UX**: Formatted output with syntax highlighting

## Production Readiness Tiers

### Tier 1: Automation MVP (✅ COMPLETE)
For AI agents, CI/CD, and automation:
- **Navigation**: Definition + References ✅
- **Analysis**: Diagnostics + Fixes ✅ 
- **Transformation**: WorkspaceEdit operations ✅
- **Interface**: JSON API ✅

### Tier 2: Human CLI (2-3 weeks)
For command-line developer use:
- **Output Formatting**: Human-readable with context
- **Extended Navigation**: Type definitions, implementations
- **Basic Understanding**: Hover for quick type info

### Tier 3: Full Features (4-6 weeks)
For comprehensive code operations:
- **Refactoring**: Rename, extract, organize
- **Search**: Symbols and text
- **Advanced Analysis**: Complexity, unused code

## Implementation Phases

### Phase 0: MVP Polish (1 week) ✅ IMMEDIATE
Make the current MVP more robust for existing use cases:
- Add better error messages for common failures
- Improve JSON response consistency
- Add integration examples for AI agents
- Create CI/CD pipeline templates

### Phase 1: Human UX Enhancement (Weeks 2-3) 🟡 TIER 2

#### Objectives

Enable developers to navigate code from the command line with rich context.

#### Deliverables

##### 1.1 References Command ✅ COMPLETED

```typescript
// daemon.ts - Add to handleRequest
case "references": {
  const [fileArg, lineStr, charStr] = args[0].split(":");
  const filePath = resolveProjectPath(projectPath, fileArg);
  const line = parseInt(lineStr, 10) - 1;
  const char = parseInt(charStr, 10) - 1;

  const refs = await lsp.getReferences(filePath, line, char, {
    includeDeclaration: flags.includeDeclaration
  });

  return formatReferences(refs, {
    context: flags.context || 2,
    groupByFile: flags.groupByFile
  });
}
```

**Implementation Status:**

- ✅ LSPClient.getReferences method implemented
- ✅ TypeScriptLSP.getReferences method implemented
- ✅ Daemon handler for references action implemented
- ✅ CLI --include-declaration flag support added
- ✅ Comprehensive unit tests (13 tests passing)
- ⚠️ Output formatting (context, groupByFile) not yet implemented

##### 1.2 Type Definition Command ❌ NOT IMPLEMENTED (BLOCKER)

```typescript
case "typeDefinition": {
  const [fileArg, lineStr, charStr] = args[0].split(":");
  const result = await lsp.getTypeDefinition(filePath, line, char);
  return formatLocation(result, { context: 3 });
}
```

##### 1.3 Implementation Command ❌ NOT IMPLEMENTED (BLOCKER)

```typescript
case "implementation": {
  const result = await lsp.getImplementation(filePath, line, char);
  return formatLocations(result, { preview: true });
}
```

##### 1.4 Symbol Search ❌ NOT IMPLEMENTED (BLOCKER)

```typescript
case "symbols": {
  const query = args[0];
  const symbols = flags.scope === "file"
    ? await lsp.getDocumentSymbols(filePath)
    : await lsp.getWorkspaceSymbols(query);

  return formatSymbols(symbols, {
    kind: flags.kind,
    limit: flags.limit
  });
}
```

##### 1.5 Output Formatter ❌ NOT IMPLEMENTED (CRITICAL)

```typescript
// New file: src/formatter.ts
export class OutputFormatter {
  formatLocation(location: Location, options: FormatOptions): string {
    const lines = this.getContextLines(location, options.context);
    return this.renderBox(lines, location);
  }

  private renderBox(lines: Line[], highlight: Range): string {
    // Beautiful box-drawing output with syntax highlighting
  }
}
```

#### Success Criteria

- [x] References command working
- [x] Definition command working
- [ ] Type definition command working ❌
- [ ] Implementation command working ❌
- [ ] Symbols command working ❌
- [ ] Context shown for all results ❌
- [x] Response time < 100ms ✅
- [ ] Human-readable output ❌
- [x] JSON output ✅

### Phase 2: Code Understanding (Weeks 3-4) 🔴 CRITICAL FOR PRODUCTION

#### Objectives

Provide rich information about code without opening files.

#### Deliverables

##### 2.1 Hover Information

```typescript
case "hover": {
  const hover = await lsp.getHover(filePath, line, char);
  return {
    type: hover.contents.value,
    documentation: hover.contents.documentation,
    range: hover.range
  };
}
```

##### 2.2 Signature Help

```typescript
case "signature": {
  const sig = await lsp.getSignatureHelp(filePath, line, char);
  return formatSignatureHelp(sig);
}
```

##### 2.3 Document Symbols with Tree View

```typescript
case "outline": {
  const symbols = await lsp.getDocumentSymbols(uri);
  return formatSymbolTree(symbols);
}
```

##### 2.4 Enhanced Type Information

```typescript
case "type-info": {
  const typeInfo = await lsp.getExpandedType(filePath, line, char);
  return formatTypeHierarchy(typeInfo);
}
```

#### Success Criteria

- [ ] Hover shows type and documentation
- [ ] Signature help for function calls
- [ ] Tree view for document symbols
- [ ] Rich type information display

### Phase 3: Refactoring Commands (Weeks 5-6) 🔴 CRITICAL FOR PRODUCTION

#### Objectives

Enable safe code transformations from the command line.

#### Deliverables

##### 3.1 Rename Command

```typescript
case "rename": {
  const [fileArg, lineStr, charStr, newName] = args;
  const edit = await lsp.getRenameEdit(filePath, line, char, newName);

  if (flags.preview) {
    return formatWorkspaceEdit(edit, { showDiff: true });
  }

  const result = await lsp.applyWorkspaceEdit(edit);
  return { applied: result.applied, filesChanged: result.filesChanged };
}
```

##### 3.2 Code Actions

```typescript
case "codeAction": {
  const actions = await lsp.getCodeActions(uri, range, diagnostics);

  if (flags.list) {
    return actions.map((a, i) => ({
      index: i,
      title: a.title,
      kind: a.kind
    }));
  }

  const selected = actions[flags.apply];
  return await lsp.executeCodeAction(selected);
}
```

##### 3.3 Extract Refactorings

```typescript
case "extract-function": {
  const action = await lsp.getExtractFunctionAction(uri, range, name);
  return await lsp.applyCodeAction(action);
}

case "extract-variable": {
  const action = await lsp.getExtractVariableAction(uri, range, name);
  return await lsp.applyCodeAction(action);
}
```

#### Success Criteria

- [ ] Rename with preview mode
- [ ] Code actions list and apply
- [ ] Extract function/variable
- [ ] All refactorings are atomic

### Phase 4: Analysis Tools (Weeks 7-8) 🟡 MEDIUM

#### Objectives

Provide deep insights into code quality and structure.

#### Deliverables

##### 4.1 Enhanced Diagnostics

```typescript
interface AnalysisResult {
  diagnostics: Diagnostic[];
  metrics: {
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
  suggestions: CodeAction[];
}
```

##### 4.2 Unused Code Detection

```typescript
async findUnusedExports(projectPath: string): Promise<UnusedExport[]> {
  // Analyze all exports and their usage
  const exports = await this.getAllExports();
  const usage = await this.findAllImports();
  return this.detectUnused(exports, usage);
}
```

##### 4.3 Complexity Analysis

```typescript
interface ComplexityReport {
  cyclomatic: number;
  cognitive: number;
  halstead: HalsteadMetrics;
  maintainabilityIndex: number;
}
```

#### Success Criteria

- [ ] Find unused exports/variables
- [ ] Calculate complexity metrics
- [ ] Provide actionable suggestions
- [ ] Performance < 1s for file analysis

### Phase 5: Search Capabilities (Week 9) 🟡 MEDIUM

#### Objectives

Powerful code search beyond simple text matching.

#### Deliverables

##### 5.1 Text Search Integration

```typescript
async searchText(pattern: string, options: SearchOptions): Promise<SearchResult[]> {
  // Use ripgrep with LSP context
  const textMatches = await this.ripgrep(pattern, options);
  return this.enrichWithLSPContext(textMatches);
}
```

##### 5.2 Semantic Symbol Search

```typescript
async searchSymbols(query: string, options: SymbolSearchOptions): Promise<Symbol[]> {
  const symbols = await this.lsp.getWorkspaceSymbols(query);
  return this.rankByRelevance(symbols, query);
}
```

#### Success Criteria

- [ ] Fast text search with context
- [ ] Symbol search with ranking
- [ ] Integration with LSP data
- [ ] < 500ms for project-wide search

### Phase 6: Command Migration (Week 10) 🟢 LOW

#### Objectives

Implement new command structure while maintaining compatibility.

#### Deliverables

##### 6.1 New Command Structure

```typescript
// New structure
program
  .command("navigate")
  .description("Code navigation commands")
  .command("def <position>")
  .command("refs <position>")
  .command("type <position>");

// Compatibility aliases
program
  .command("run <alias> definition <args...>")
  .action((...args) => redirectToNew("navigate", "def", args));
```

##### 6.2 Help System Enhancement

```typescript
// Enhanced help with examples
const examples = {
  "navigate def": [
    "lsp-top navigate def src/api.ts:30:15",
    "lsp-top navigate def src/user.ts:User:1:1",
  ],
};
```

#### Success Criteria

- [ ] New command structure live
- [ ] Old commands still work
- [ ] Help includes examples
- [ ] Migration guide published

## Technical Implementation Details

### Architecture Enhancements

#### 1. Caching Layer

```typescript
class CacheManager {
  private symbolCache: Map<string, SymbolInformation[]>;
  private typeCache: Map<string, TypeInfo>;
  private ttl: number = 5000; // 5 seconds

  async getOrCompute<T>(key: string, compute: () => Promise<T>): Promise<T> {
    if (this.has(key) && !this.isExpired(key)) {
      return this.get(key);
    }
    const value = await compute();
    this.set(key, value);
    return value;
  }
}
```

#### 2. Output Formatting System

```typescript
interface OutputFormat {
  human: (data: any) => string;
  json: (data: any) => string;
  markdown: (data: any) => string;
}

class FormatRegistry {
  register(command: string, format: OutputFormat): void;
  format(command: string, data: any, format: string): string;
}
```

#### 3. Performance Monitoring

```typescript
class PerformanceMonitor {
  async measure<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = process.hrtime.bigint();
    try {
      const result = await fn();
      this.recordSuccess(operation, start);
      return result;
    } catch (error) {
      this.recordFailure(operation, start, error);
      throw error;
    }
  }
}
```

### Testing Strategy

#### Unit Tests

- Each command handler
- Output formatters
- Cache behavior
- Error handling

#### Integration Tests

- Full command flow
- LSP communication
- File system operations
- Git integration

#### Performance Tests

- Response time benchmarks
- Memory usage monitoring
- Concurrent request handling

### Error Handling

```typescript
class LSPError extends Error {
  constructor(
    message: string,
    public code: string,
    public exitCode: number = 1,
  ) {
    super(message);
  }
}

// Graceful degradation
async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    log.warn("Primary method failed, using fallback", error);
    return await fallback();
  }
}
```

## Rollout Plan

### Week 1: MVP Polish & Launch

- Document AI agent integration patterns
- Create example CI/CD workflows
- Publish to npm as v0.8.0 (Automation MVP)
- **Target**: AI tools and CI/CD pipelines can start using immediately

### Week 2-3: Human UX (Tier 2)

- Implement output formatter
- Add type definition and implementation commands
- Add basic hover information
- Release v0.9.0 (Human-usable CLI)

### Week 4-6: Full Features (Tier 3)

- Implement rename refactoring
- Add symbol search
- Add code actions
- Release v1.0.0 (Feature-complete)

### Future: Enhanced Capabilities

- Multi-language support
- Advanced analysis features
- Plugin system
- Release v2.0.0

## Success Metrics

### Tier 1: Automation MVP (v0.8) ✅ READY NOW

- [x] Core navigation (definition, references) working
- [x] Diagnostics and auto-fix working
- [x] JSON API complete with schemas
- [x] < 100ms response times achieved
- [x] Test infrastructure solid
- [x] Can be used by AI agents today

### Tier 2: Human CLI (v0.9)

- [ ] Human-readable output formatting
- [ ] Type definition navigation
- [ ] Hover information
- [ ] 5+ developers using in daily workflow

### Tier 3: Feature Complete (v1.0)

- [ ] Rename refactoring
- [ ] Symbol search
- [ ] 90% test coverage
- [ ] 50+ active users
- [ ] 5+ AI tools integrated

## Risk Mitigation

### Technical Risks

- **LSP Compatibility**: Test with multiple TypeScript versions
- **Performance**: Implement caching and lazy loading
- **Reliability**: Extensive error handling and recovery

### User Risks

- **Breaking Changes**: Maintain compatibility layer
- **Learning Curve**: Provide examples and tutorials
- **Migration**: Clear upgrade path from v1

## Next Steps

1. **Immediate Priority** (BLOCKER):
   - Implement type definition command
   - Implement implementation command  
   - Implement symbol search
   - Add human-readable output formatter
   - **Current status: Tool is not production-ready without these**

2. **Short Term** (Required for v1.0):
   - Complete Phase 1 (navigation) - CRITICAL
   - Complete Phase 2 (hover/signatures) - CRITICAL
   - Complete Phase 3 (rename refactoring) - CRITICAL
   - Only then can this be considered production-ready

3. **Long Term** (Post v1.0):
   - Enhanced analysis tools
   - Multi-language support
   - Plugin system design

## Summary

**Current Status**: Tier 1 MVP Complete - Production-ready for AI/automation use cases
**Next Milestone**: Tier 2 Human CLI (2-3 weeks) 
**Full Feature Set**: Tier 3 (4-6 weeks total)

### Key Insight
The tool is **already production-ready** for its primary purpose: "complex code operations quickly and safely" in automated contexts (AI agents, CI/CD). Human CLI enhancement is a UX improvement, not a blocker for the tool's core value proposition.

### Recommended Action
1. **Immediately**: Ship v0.8.0 for AI/automation use
2. **Short-term**: Enhance human UX for v0.9.0
3. **Medium-term**: Complete full feature set for v1.0.0
