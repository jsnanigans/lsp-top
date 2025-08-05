# LSP-Top Implementation Plan v2

## Overview
This plan outlines the transformation of LSP-Top from a basic LSP wrapper to a comprehensive command-line IDE. The implementation is structured in phases, with clear priorities and deliverables.

## Current State Assessment

### ✅ Completed Features
- **Core Infrastructure**: Daemon, LSP client, CLI framework
- **Schema Versioning**: CommandResult with schemaVersion "v1"
- **Inspect Pipeline**: Full implementation with diagnostics, fixes, format, organize
- **Edit Operations**: Apply/plan WorkspaceEdit functionality
- **Performance Monitoring**: Metrics, histograms, trace flags
- **Basic Navigation**: Definition command only

### ❌ Critical Gaps
- **Navigation**: Missing refs, type, impl, symbols commands
- **Code Understanding**: No hover, signature, outline functionality
- **Refactoring**: No rename, extract, or code actions
- **Search**: No text or symbol search
- **Output Formatting**: Poor human readability, no context

## Implementation Phases

### Phase 1: Core Navigation Commands (Weeks 1-2) 🔴 CRITICAL

#### Objectives
Enable developers to navigate code from the command line with rich context.

#### Deliverables

##### 1.1 References Command
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

##### 1.2 Type Definition Command
```typescript
case "typeDefinition": {
  const [fileArg, lineStr, charStr] = args[0].split(":");
  const result = await lsp.getTypeDefinition(filePath, line, char);
  return formatLocation(result, { context: 3 });
}
```

##### 1.3 Implementation Command
```typescript
case "implementation": {
  const result = await lsp.getImplementation(filePath, line, char);
  return formatLocations(result, { preview: true });
}
```

##### 1.4 Symbol Search
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

##### 1.5 Output Formatter
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
- [ ] All navigation commands working
- [ ] Context shown for all results
- [ ] Response time < 100ms
- [ ] Human-readable and JSON output

### Phase 2: Code Understanding (Weeks 3-4) 🟠 HIGH

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

### Phase 3: Refactoring Commands (Weeks 5-6) 🟠 HIGH

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
  .command('navigate')
  .description('Code navigation commands')
  .command('def <position>')
  .command('refs <position>')
  .command('type <position>');

// Compatibility aliases
program
  .command('run <alias> definition <args...>')
  .action((...args) => redirectToNew('navigate', 'def', args));
```

##### 6.2 Help System Enhancement
```typescript
// Enhanced help with examples
const examples = {
  'navigate def': [
    'lsp-top navigate def src/api.ts:30:15',
    'lsp-top navigate def src/user.ts:User:1:1'
  ]
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
    public exitCode: number = 1
  ) {
    super(message);
  }
}

// Graceful degradation
async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>
): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    log.warn('Primary method failed, using fallback', error);
    return await fallback();
  }
}
```

## Rollout Plan

### Week 1-2: Phase 1
- Implement navigation commands
- Deploy to beta testers
- Gather feedback

### Week 3-4: Phase 2
- Add understanding commands
- Update documentation
- Release v0.9.0

### Week 5-6: Phase 3
- Implement refactoring
- Extensive testing
- Release v0.10.0

### Week 7-8: Phase 4-5
- Analysis and search
- Performance optimization
- Release v0.11.0

### Week 9-10: Phase 6
- Command migration
- Final polish
- Release v1.0.0

## Success Metrics

### Functionality
- ✅ All planned commands implemented
- ✅ < 200ms response time for navigation
- ✅ < 1s for analysis operations
- ✅ Zero data loss in refactoring

### Quality
- ✅ 90% test coverage
- ✅ No critical bugs in production
- ✅ Clear error messages
- ✅ Comprehensive documentation

### Adoption
- ✅ 100+ GitHub stars
- ✅ 50+ active users
- ✅ 5+ AI tools integrated
- ✅ Positive user feedback

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

1. **Immediate** (This Week):
   - Set up feature branches
   - Begin Phase 1 implementation
   - Create test infrastructure

2. **Short Term** (Next Month):
   - Complete Phases 1-3
   - Beta testing program
   - Documentation updates

3. **Long Term** (Next Quarter):
   - Full v1.0 release
   - Multi-language support
   - Plugin system design