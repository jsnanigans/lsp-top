# LSP-Top Implementation Roadmap

## Goal
Transform `lsp-top` from a basic LSP wrapper into a powerful command-line IDE that enables developers and AI agents to understand, navigate, and refactor TypeScript codebases without a traditional editor.

## Current State → Target State

### Current State (What We Have)
- ✅ Basic daemon and LSP infrastructure
- ✅ `inspect` command with diagnostics and fixes
- ✅ `edit apply/plan` for WorkspaceEdit
- ✅ Single `definition` navigation command
- ✅ Format/organize imports via inspect
- ❌ Limited navigation capabilities
- ❌ No code understanding tools
- ❌ Poor output formatting
- ❌ Missing essential refactoring commands

### Target State (What We Need)
- Complete navigation suite (def, refs, type, impl, symbols)
- Rich code exploration tools (hover, signature, outline)
- Comprehensive refactoring capabilities
- Human-friendly output with syntax highlighting
- Powerful search and analysis tools
- Seamless integration with command-line workflows

## Implementation Phases

### Phase 1: Core Navigation (Priority: CRITICAL)
**Goal**: Enable basic code navigation from command line

#### 1.1 Complete Jump Commands
```typescript
// Add to daemon.ts handleRequest()
case "references": {
  const [fileArg, lineStr, charStr] = args[0].split(":");
  const filePath = resolveProjectPath(projectPath, fileArg);
  return await lsp.getReferences(filePath, line, char, {
    includeDeclaration: flags.includeDeclaration
  });
}

case "typeDefinition": {
  // Similar pattern for type definition
}

case "implementation": {
  // Similar pattern for implementation
}
```

#### 1.2 Symbol Search
```typescript
// New method in TypeScriptLSP
async getWorkspaceSymbols(query: string): Promise<SymbolInformation[]> {
  return await this.client.sendRequest("workspace/symbol", {
    query
  });
}

async getDocumentSymbols(uri: string): Promise<DocumentSymbol[]> {
  return await this.client.sendRequest("textDocument/documentSymbol", {
    textDocument: { uri }
  });
}
```

#### 1.3 Output Formatting
```typescript
// New formatter module
export class OutputFormatter {
  formatLocation(location: Location, context: number = 2): string {
    // Format with box drawing and syntax highlighting
  }
  
  formatSymbol(symbol: SymbolInformation): string {
    // Format symbol with kind icon and signature
  }
}
```

**Deliverables**:
- [ ] `lsp-top run <alias> references <file:line:col>`
- [ ] `lsp-top run <alias> typeDefinition <file:line:col>`
- [ ] `lsp-top run <alias> implementation <file:line:col>`
- [ ] `lsp-top run <alias> symbols <query>`
- [ ] Context-aware output formatting

### Phase 2: Code Understanding (Priority: HIGH)
**Goal**: Provide rich information about code without opening files

#### 2.1 Hover Information
```typescript
case "hover": {
  const [fileArg, lineStr, charStr] = args[0].split(":");
  const hover = await lsp.getHover(filePath, line, char);
  return formatHoverInfo(hover);
}
```

#### 2.2 Signature Help
```typescript
case "signature": {
  const signature = await lsp.getSignatureHelp(filePath, line, char);
  return formatSignatureHelp(signature);
}
```

#### 2.3 Document Outline
```typescript
case "outline": {
  const symbols = await lsp.getDocumentSymbols(uri);
  return formatDocumentOutline(symbols);
}
```

**Deliverables**:
- [ ] `lsp-top explore hover <file:line:col>`
- [ ] `lsp-top explore signature <file:line:col>`
- [ ] `lsp-top explore outline <file>`
- [ ] Rich formatting for all outputs

### Phase 3: Refactoring Commands (Priority: HIGH)
**Goal**: Enable safe code transformations from command line

#### 3.1 Rename Command
```typescript
case "rename": {
  const [fileArg, lineStr, charStr, newName] = args;
  const edit = await lsp.getRenameEdit(filePath, line, char, newName);
  if (flags.preview) {
    return formatWorkspaceEdit(edit);
  }
  return await lsp.applyWorkspaceEdit(edit);
}
```

#### 3.2 Code Actions
```typescript
case "codeAction": {
  const actions = await lsp.getCodeActions(uri, range, diagnostics);
  if (flags.list) {
    return formatCodeActions(actions);
  }
  // Apply selected action
}
```

#### 3.3 Extract Refactorings
```typescript
case "extract": {
  // Use TypeScript specific extract function/constant/type actions
  const action = await lsp.getExtractAction(uri, range, kind);
  return await lsp.applyCodeAction(action);
}
```

**Deliverables**:
- [ ] `lsp-top refactor rename <file:line:col> <newName>`
- [ ] `lsp-top refactor codeaction <file> --list`
- [ ] `lsp-top refactor extract-function <file:range> <name>`
- [ ] Preview mode for all refactorings

### Phase 4: Enhanced Analysis (Priority: MEDIUM)
**Goal**: Provide deep code insights

#### 4.1 Unused Code Detection
```typescript
// Leverage TypeScript's unused diagnostics
async findUnusedCode(projectPath: string): Promise<UnusedItem[]> {
  // Scan all files for unused exports/variables
}
```

#### 4.2 Complexity Analysis
```typescript
// Use AST analysis for complexity metrics
async analyzeComplexity(filePath: string): Promise<ComplexityReport> {
  // Calculate cyclomatic complexity, nesting depth, etc.
}
```

**Deliverables**:
- [ ] `lsp-top analyze unused --type exports`
- [ ] `lsp-top analyze complexity <file>`
- [ ] Project-wide analysis capabilities

### Phase 5: Search and Navigation (Priority: MEDIUM)
**Goal**: Powerful code search capabilities

#### 5.1 Text Search Integration
```typescript
// Integrate with ripgrep for fast text search
async searchText(pattern: string, options: SearchOptions): Promise<SearchResult[]> {
  // Use ripgrep with LSP context
}
```

#### 5.2 Semantic Search
```typescript
// Search by semantic meaning
async searchSemantic(query: string): Promise<SemanticMatch[]> {
  // Use LSP symbols + type information
}
```

**Deliverables**:
- [ ] `lsp-top search text <pattern>`
- [ ] `lsp-top search symbol <query>`
- [ ] Advanced filtering options

### Phase 6: Command Structure Refactor (Priority: LOW)
**Goal**: Implement new command structure

#### 6.1 New CLI Structure
```typescript
// Refactor CLI to use command groups
program
  .command('navigate')
  .command('def <position>')
  .action(handleNavigateDef);

program
  .command('explore')
  .command('hover <position>')
  .action(handleExploreHover);
```

#### 6.2 Backward Compatibility
```typescript
// Maintain aliases for existing commands
program
  .command('run <alias> definition <args...>')
  .action((alias, args) => {
    // Redirect to new navigate def command
  });
```

**Deliverables**:
- [ ] New command structure implementation
- [ ] Backward compatibility layer
- [ ] Updated help system

## Technical Considerations

### 1. Performance Optimizations
- Cache frequently accessed data (symbols, types)
- Batch LSP requests where possible
- Implement progressive loading for large results

### 2. Output Formatting
- Detect TTY for rich formatting
- Support NO_COLOR environment variable
- Provide consistent JSON schemas

### 3. Error Handling
- Graceful degradation when LSP features unavailable
- Clear error messages with suggested fixes
- Proper exit codes for scripting

### 4. Testing Strategy
- Unit tests for each command
- Integration tests with test-project
- Performance benchmarks

## Success Metrics

### Functionality
- [ ] Can navigate any symbol in < 200ms
- [ ] Can understand code without opening files
- [ ] Can safely refactor across project
- [ ] Can analyze code quality efficiently

### Usability
- [ ] Commands complete common tasks in 1-2 steps
- [ ] Output is immediately understandable
- [ ] Works seamlessly in scripts and pipes
- [ ] AI agents can use effectively

### Performance
- [ ] Navigation commands < 100ms
- [ ] Analysis commands < 500ms
- [ ] Refactoring preview < 1s
- [ ] Memory usage < 200MB

## Timeline

### Week 1-2: Phase 1 (Core Navigation)
- Implement missing navigation commands
- Add output formatting
- Test with real projects

### Week 3-4: Phase 2 (Code Understanding)
- Add hover and signature help
- Implement document outline
- Polish output formatting

### Week 5-6: Phase 3 (Refactoring)
- Implement rename command
- Add code actions support
- Add extract refactorings

### Week 7-8: Phase 4-5 (Analysis & Search)
- Add unused code detection
- Implement search capabilities
- Performance optimization

### Week 9-10: Phase 6 (Polish)
- Refactor command structure
- Update documentation
- Release v1.0

## Next Steps

1. **Immediate Actions**:
   - Create feature branches for each phase
   - Set up testing infrastructure
   - Begin Phase 1 implementation

2. **Communication**:
   - Update README with roadmap
   - Create GitHub issues for each deliverable
   - Set up progress tracking

3. **Community**:
   - Gather feedback on command design
   - Find early adopters for testing
   - Document use cases

This roadmap transforms `lsp-top` from a basic tool into an essential command-line IDE that empowers both human developers and AI agents to work effectively with TypeScript codebases.