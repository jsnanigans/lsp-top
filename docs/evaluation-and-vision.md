# LSP-Top Evaluation and Vision

## Current State Analysis

### What Works Well
1. **Core Infrastructure**: Daemon architecture, LSP client, and CLI framework are solid
2. **Inspect Pipeline**: Complete implementation for diagnostics, fixes, and formatting
3. **Edit Operations**: Basic WorkspaceEdit application functionality
4. **Performance**: Metrics and tracing infrastructure in place

### Critical Gaps for Command-Line IDE Experience

#### 1. **Navigation is Severely Limited**
- Only `definition` command exists
- Missing essential navigation:
  - `type` - What type does this expression have?
  - `references` - Where is this symbol used?
  - `implementation` - Where are the implementations of this interface?
  - `symbols` - What symbols are in this file/project?
  - `hover` - What documentation/type info is available?

#### 2. **No Code Understanding Tools**
- No way to explore code structure
- No symbol search
- No call hierarchy
- No type hierarchy
- No documentation access

#### 3. **Limited Refactoring Capabilities**
- Only format/organize imports via inspect
- Missing critical refactors:
  - `rename` - Rename symbols across the project
  - `extract` - Extract method/variable
  - `inline` - Inline variable/method
  - `move` - Move symbol to another file

#### 4. **Poor Human Interface**
- Output is raw JSON or minimal text
- No code previews with context
- No syntax highlighting
- No interactive selection for ambiguous results

## Vision: Command-Line IDE

### Core Philosophy
`lsp-top` should provide **80% of IDE functionality** through simple, composable commands that work seamlessly for both humans and AI agents.

### Key Design Principles

1. **Information First**: Every command should provide rich, contextual information
2. **Progressive Disclosure**: Simple defaults, detailed options
3. **Composable**: Commands should work together via pipes and scripts
4. **Context-Aware**: Show surrounding code, not just positions
5. **Action-Oriented**: From information to action in one step

### Essential Command Groups

#### 1. **Explore** - Understanding Code
```bash
# What is this?
lsp-top explore hover src/index.ts:10:5
# Shows: Type info, documentation, signature

# What's in this file?
lsp-top explore symbols src/index.ts
# Shows: Classes, methods, functions with signatures

# What does this type look like?
lsp-top explore type-def src/index.ts:10:5
# Shows: Full type definition with all properties

# Show me the implementation
lsp-top explore implementation src/interface.ts:5:10
# Shows: All implementations with preview
```

#### 2. **Navigate** - Moving Through Code
```bash
# Go to definition
lsp-top navigate def src/index.ts:10:5
# Shows: Definition location with context

# Find all usages
lsp-top navigate refs src/index.ts:10:5 --context 3
# Shows: All references with 3 lines of context

# Find by symbol name
lsp-top navigate symbol "UserService" --type class
# Shows: All matching symbols with preview

# Call hierarchy
lsp-top navigate calls src/service.ts:30:5 --direction in
# Shows: What calls this function
```

#### 3. **Analyze** - Code Quality
```bash
# Check file/project
lsp-top analyze file src/index.ts
# Shows: Errors, warnings, suggestions with fixes

# Find issues in changed files
lsp-top analyze changed --fix-preview
# Shows: Issues with proposed fixes

# Unused code
lsp-top analyze unused --type exports
# Shows: Unused exports, variables, etc.

# Complexity
lsp-top analyze complexity src/service.ts
# Shows: Cyclomatic complexity, cognitive load
```

#### 4. **Refactor** - Code Transformation
```bash
# Rename across project
lsp-top refactor rename src/old.ts:10:5 "newName" --preview
# Shows: All changes that would be made

# Extract function
lsp-top refactor extract-function src/long.ts:20-30 "calculateTotal"
# Shows: New function and updated code

# Move symbol
lsp-top refactor move src/utils.ts:exportedFn src/helpers.ts
# Shows: Changes to move symbol and update imports

# Inline variable
lsp-top refactor inline src/code.ts:15:8
# Shows: Code with variable inlined
```

#### 5. **Generate** - Code Creation
```bash
# Generate implementation
lsp-top generate implementation src/interface.ts:IService
# Creates: Implementation skeleton

# Generate tests
lsp-top generate tests src/service.ts
# Creates: Test file with test cases

# Generate documentation
lsp-top generate docs src/api.ts --format jsdoc
# Adds: JSDoc comments
```

### Output Format Design

#### Human-Friendly Output
```
┌─ src/service.ts:45:10 ─────────────────────────┐
│ 43 │   async processUser(id: string) {         │
│ 44 │     const user = await this.getUser(id);  │
│ 45 │     return user.process();                 │
│    │            ^^^^                           │
│ 46 │   }                                       │
└─────────────────────────────────────────────────┘
  Type: (method) User.process(): Promise<Result>
  Defined at: src/models/user.ts:23:5
```

#### Machine-Friendly Output (--json)
```json
{
  "schemaVersion": "v1",
  "command": "navigate.def",
  "result": {
    "location": {
      "uri": "file:///project/src/models/user.ts",
      "range": {
        "start": { "line": 22, "character": 4 },
        "end": { "line": 22, "character": 11 }
      }
    },
    "preview": {
      "lines": [
        { "number": 22, "text": "  async process(): Promise<Result> {" },
        { "number": 23, "text": "    // Process user data" }
      ],
      "highlight": { "line": 22, "start": 4, "end": 11 }
    }
  }
}
```

### Integration with Command-Line Workflow

#### 1. **Verification Workflow**
```bash
# After editing a file
lsp-top analyze file src/service.ts --fix | lsp-top edit apply

# Check if changes broke anything
lsp-top analyze changed --since HEAD
```

#### 2. **Exploration Workflow**
```bash
# Understand a codebase
lsp-top explore symbols --tree | grep -E "class|interface"
lsp-top navigate refs src/core.ts:MainClass --count-only

# Find implementation details
lsp-top explore hover src/api.ts:15:10 | grep -A5 "Returns:"
```

#### 3. **Refactoring Workflow**
```bash
# Safe rename
lsp-top refactor rename src/old.ts:10:5 "newName" --dry-run > changes.json
# Review changes
lsp-top edit apply changes.json
```

### Performance Optimizations

1. **Intelligent Caching**
   - Cache symbol tables per file
   - Cache type information
   - Invalidate on file changes

2. **Batch Operations**
   - Process multiple files in one LSP request
   - Aggregate results efficiently

3. **Progressive Loading**
   - Load only necessary context
   - Expand on demand

### Language Agnostic Design

The command structure should work for any LSP:
- TypeScript/JavaScript
- Python (pylsp)
- Rust (rust-analyzer)
- Go (gopls)

Commands map to standard LSP methods:
- `explore hover` → `textDocument/hover`
- `navigate def` → `textDocument/definition`
- `refactor rename` → `textDocument/rename`

### Success Metrics

1. **Human Usability**
   - Complete common tasks in 1-2 commands
   - Understand code without opening an editor
   - Refactor safely from command line

2. **AI Agent Compatibility**
   - Structured JSON output
   - Predictable command patterns
   - Rich context in responses

3. **Performance**
   - < 100ms for navigation commands
   - < 500ms for analysis commands
   - < 1s for project-wide refactors

## Implementation Priorities

### Phase 1: Core Navigation (Week 1-2)
1. Implement missing jump commands (type, refs, impl, symbols)
2. Add hover information
3. Improve output formatting with context

### Phase 2: Analysis Tools (Week 3-4)
1. Enhance inspect with better formatting
2. Add unused code detection
3. Add complexity analysis

### Phase 3: Refactoring (Week 5-6)
1. Implement rename command
2. Add extract function/variable
3. Add move symbol

### Phase 4: Polish (Week 7-8)
1. Syntax highlighting in output
2. Interactive mode for ambiguous results
3. Performance optimizations

## Conclusion

`lsp-top` has the potential to be the missing link between command-line tools and IDE functionality. By focusing on information retrieval, code understanding, and safe transformations, it can enable both human developers and AI agents to work effectively with large codebases without a traditional IDE.

The key is to make common tasks simple while keeping complex tasks possible, all while maintaining excellent performance and a consistent, predictable interface.