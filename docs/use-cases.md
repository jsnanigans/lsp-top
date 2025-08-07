# LSP-Top Use Cases

## Current Implementation (v0.9)

### 1. Command-Line Only Development

**Scenario**: SSH'd into a remote server, no GUI available

```bash
# Initialize a project
lsp-top init myapp /path/to/project

# Find where something is defined
lsp-top run myapp definition src/api.ts:45:10

# See all places it's used
lsp-top run myapp references src/api.ts:45:10

# Check for type errors
lsp-top run myapp diagnostics src/api.ts

# Inspect file for issues
lsp-top inspect myapp file src/api.ts

# Get JSON output for scripting
lsp-top run myapp definition src/api.ts:45:10 --json
```

### 2. Quick Code Verification

**Scenario**: Just edited a file, want to verify it's correct

```bash
# Check for type errors and issues
lsp-top inspect myapp file src/service.ts

# Get detailed diagnostics
lsp-top run myapp diagnostics src/service.ts

# Preview quick fixes (no writes)
lsp-top inspect myapp file src/service.ts --fix-dry

# Check all changed files in git
lsp-top inspect myapp changed

# Check only staged files
lsp-top inspect myapp changed --staged
```

### 3. Code Review from Terminal

**Scenario**: Reviewing PR changes without IDE

```bash
# Check all changed files for issues
lsp-top inspect myapp changed

# Find definition of a symbol
lsp-top run myapp definition src/new-feature.ts:30:15

# See where new function is called
lsp-top run myapp references src/new-feature.ts:30:15

# Include the declaration in references
lsp-top run myapp references src/new-feature.ts:30:15 --include-declaration
```

### 4. Exploring Unknown Codebase

**Scenario**: New to a project, need to understand structure

```bash
# Initialize the project first
lsp-top init project ./

# Find where a class is defined
lsp-top run project definition src/core.ts:10:5

# Find all references to a class or function
lsp-top run project references src/types.ts:15:10

# Check files for type errors to understand constraints
lsp-top run project diagnostics src/types.ts

# Batch check multiple files
for file in src/*.ts; do
  echo "=== $file ==="
  lsp-top run project diagnostics "$file"
done
```

### 5. Project Management

**Scenario**: Managing multiple projects

```bash
# Initialize multiple projects with aliases
lsp-top init frontend ./packages/frontend
lsp-top init backend ./packages/backend
lsp-top init shared ./packages/shared

# List all configured projects
lsp-top configure --print

# Remove a project
lsp-top remove frontend

# Check project configuration
lsp-top diagnose backend

# Start the daemon for faster responses
lsp-top start-server

# Check daemon status
lsp-top metrics
```

## For AI Agents

### 1. Automated Code Analysis

**Use Case**: AI analyzing codebase for improvements

```python
# AI agent script
import subprocess
import json

def analyze_project(alias):
    # Get all TypeScript files
    files = subprocess.run(
        ["find", ".", "-name", "*.ts"],
        capture_output=True,
        text=True
    ).stdout.strip().split('\n')

    issues = []
    for file in files:
        # Check each file for diagnostics
        result = subprocess.run(
            ["lsp-top", "run", alias, "diagnostics", file, "--json"],
            capture_output=True,
            text=True
        )
        data = json.loads(result.stdout)
        if data.get("diagnostics"):
            issues.append({
                "file": file,
                "issues": data["diagnostics"]
            })

    return issues
```

### 2. Intelligent Code Navigation

**Use Case**: AI understanding code relationships

```python
def understand_function(alias, file_pos):
    # Find where it's defined
    definition = run_command(
        f"lsp-top run {alias} definition {file_pos} --json"
    )
    
    # Find all usages
    refs = run_command(
        f"lsp-top run {alias} references {file_pos} --json"
    )
    
    # Get diagnostics for context
    file_path = file_pos.split(':')[0]
    diagnostics = run_command(
        f"lsp-top run {alias} diagnostics {file_path} --json"
    )

    return {
        "definition": json.loads(definition),
        "references": json.loads(refs),
        "issues": json.loads(diagnostics).get("diagnostics", [])
    }
```

### 3. Batch Processing

**Use Case**: AI processing multiple files

```python
def batch_check_files(alias, file_patterns):
    import glob
    
    results = {}
    
    for pattern in file_patterns:
        files = glob.glob(pattern, recursive=True)
        
        for file in files:
            # Get diagnostics
            result = subprocess.run(
                ["lsp-top", "run", alias, "diagnostics", file, "--json"],
                capture_output=True,
                text=True
            )
            
            data = json.loads(result.stdout)
            if data.get("diagnostics"):
                results[file] = {
                    "errors": [d for d in data["diagnostics"] if d["severity"] == 1],
                    "warnings": [d for d in data["diagnostics"] if d["severity"] == 2]
                }
    
    return results
```

### 4. Code Verification

**Use Case**: AI verifying code changes

```python
def verify_changes(alias):
    # Check changed files
    result = subprocess.run(
        ["lsp-top", "inspect", alias, "changed", "--json"],
        capture_output=True,
        text=True
    )
    
    data = json.loads(result.stdout)
    
    # Analyze each diagnostic
    critical_issues = []
    for diagnostic in data.get("diagnostics", []):
        if diagnostic["severity"] == 1:  # Error
            critical_issues.append({
                "file": diagnostic.get("file"),
                "message": diagnostic["message"],
                "line": diagnostic["range"]["start"]["line"]
            })
    
    return {
        "has_errors": len(critical_issues) > 0,
        "critical_issues": critical_issues
    }
```

### 5. Cross-Reference Analysis

**Use Case**: AI understanding code dependencies

```python
def analyze_dependencies(alias, entry_point):
    """Trace dependencies from an entry point"""
    
    visited = set()
    to_visit = [entry_point]
    dependencies = {}
    
    while to_visit:
        current = to_visit.pop(0)
        if current in visited:
            continue
            
        visited.add(current)
        
        # Find all references in this file
        result = subprocess.run(
            ["lsp-top", "run", alias, "references", current, "--json"],
            capture_output=True,
            text=True
        )
        
        refs = json.loads(result.stdout)
        
        # Track dependencies
        dependencies[current] = refs
        
        # Add new files to visit
        for ref in refs:
            file_path = ref["uri"].replace("file://", "")
            location = f"{file_path}:{ref['range']['start']['line']}:{ref['range']['start']['character']}"
            if location not in visited:
                to_visit.append(location)
    
    return dependencies
```

## Integration Patterns

### 1. Git Hooks

```bash
#!/bin/bash
# pre-commit hook

# Ensure daemon is running
lsp-top start-server 2>/dev/null || true

# Check all staged files
lsp-top inspect myproject changed --staged --json > analysis.json

# Count errors
ERROR_COUNT=$(cat analysis.json | jq '[.diagnostics[] | select(.severity == 1)] | length')

if [ "$ERROR_COUNT" -gt 0 ]; then
    echo "Errors found in staged files:"
    lsp-top inspect myproject changed --staged
    exit 1
fi

echo "✓ No errors found in staged files"
```

### 2. CI/CD Pipeline

```yaml
# GitHub Actions example
- name: Setup LSP-Top
  run: |
    npm install -g lsp-top
    lsp-top init project .
    lsp-top start-server

- name: Code Quality Check
  run: |
    # Check all TypeScript files
    for file in $(find src -name "*.ts"); do
      lsp-top run project diagnostics "$file" --json >> diagnostics.jsonl
    done
    
    # Count errors
    ERROR_COUNT=$(cat diagnostics.jsonl | jq -s '[.[] | .diagnostics[] | select(.severity == 1)] | length')
    
    if [ "$ERROR_COUNT" -gt 0 ]; then
      echo "::error::Found $ERROR_COUNT errors"
      cat diagnostics.jsonl | jq -r '.diagnostics[] | select(.severity == 1) | "::error file=\(.file),line=\(.range.start.line)::\(.message)"'
      exit 1
    fi
```

### 3. Editor Integration

```vim
" Vim integration for current implementation
function! LspTopDefinition()
  let pos = line('.') . ':' . col('.')
  let file = expand('%:.')
  let cmd = 'lsp-top run myproject definition ' . file . ':' . pos . ' --json'
  let result = system(cmd)
  let data = json_decode(result)
  if len(data) > 0
    let uri = data[0]['uri']
    let file = substitute(uri, 'file://', '', '')
    let line = data[0]['range']['start']['line'] + 1
    execute 'edit +' . line . ' ' . file
  endif
endfunction

function! LspTopReferences()
  let pos = line('.') . ':' . col('.')
  let file = expand('%:.')
  let cmd = 'lsp-top run myproject references ' . file . ':' . pos
  let result = system(cmd)
  echo result
endfunction

nnoremap gd :call LspTopDefinition()<CR>
nnoremap gr :call LspTopReferences()<CR>
```

### 4. Shell Aliases

```bash
# Useful aliases for current implementation
alias lsp-def='lsp-top run $(basename $PWD) definition'
alias lsp-refs='lsp-top run $(basename $PWD) references'
alias lsp-check='lsp-top run $(basename $PWD) diagnostics'
alias lsp-inspect='lsp-top inspect $(basename $PWD) file'

# Quick navigation function
function goto() {
  local project=$(basename $PWD)
  local result=$(lsp-top run $project definition "$1" --json)
  if [ ! -z "$result" ] && [ "$result" != "[]" ]; then
    local file=$(echo $result | jq -r '.[0].uri' | sed 's|file://||')
    local line=$(echo $result | jq -r '.[0].range.start.line')
    vim "+$((line + 1))" "$file"
  else
    echo "No definition found"
  fi
}

# Check current file
function lsp-current() {
  local project=$(basename $PWD)
  lsp-top run $project diagnostics "$1"
}
```

## Benefits

### For Humans

1. **No IDE Required**: Full code intelligence from terminal
2. **Remote Development**: Works over SSH
3. **Scriptable**: Automate repetitive tasks
4. **Fast**: No GUI overhead
5. **Composable**: Integrates with Unix tools

### For AI Agents

1. **Structured Data**: JSON output for easy parsing
2. **Deterministic**: Predictable command patterns
3. **Context-Rich**: Includes surrounding code
4. **Safe Operations**: Preview before applying
5. **Batch Processing**: Efficient for large codebases

## Real-World Scenarios

### 1. Debugging Production Issue

```bash
# SSH into production server
ssh prod-server

# Initialize the project
lsp-top init prod /app

# Start daemon for faster responses
lsp-top start-server

# Navigate to error location from logs
lsp-top run prod definition src/api.ts:45:10

# Find all calls to this function
lsp-top run prod references src/api.ts:45:10

# Check for type errors in the file
lsp-top run prod diagnostics src/api.ts

# Check for recent changes
git log -p src/api.ts | head -50
```

### 2. Finding Usage Patterns

```bash
# Find all uses of a class or function
lsp-top run myproject references src/utils.ts:10:5 --json > usage.json

# Parse and analyze usage
cat usage.json | jq -r '.[] | "\(.uri):\(.range.start.line)"' | while read location; do
  file=$(echo $location | cut -d: -f1 | sed 's|file://||')
  line=$(echo $location | cut -d: -f2)
  echo "Found usage in $file at line $((line + 1))"
  sed -n "$((line)),$((line + 2))p" "$file"
done
```

### 3. Code Review Automation

```bash
# Check all changed files in a PR
PROJECT_ALIAS="myproject"

# Get changed TypeScript files
for file in $(git diff --name-only main...HEAD | grep '\.ts$'); do
  echo "Checking $file..."
  
  # Get diagnostics
  lsp-top run $PROJECT_ALIAS diagnostics "$file" --json > "$file.diagnostics.json"
  
  # Count issues by severity
  ERRORS=$(cat "$file.diagnostics.json" | jq '[.diagnostics[] | select(.severity == 1)] | length')
  WARNINGS=$(cat "$file.diagnostics.json" | jq '[.diagnostics[] | select(.severity == 2)] | length')
  
  if [ "$ERRORS" -gt 0 ]; then
    echo "  ❌ $ERRORS errors found"
    cat "$file.diagnostics.json" | jq -r '.diagnostics[] | select(.severity == 1) | "    Line \(.range.start.line): \(.message)"'
  fi
  
  if [ "$WARNINGS" -gt 0 ]; then
    echo "  ⚠️  $WARNINGS warnings found"
  fi
done
```

## Known Limitations (current)

### Currently Not Implemented
- **Hover information** - `explore hover` command not yet available
- **Symbol search** - `navigate symbol` command not yet available  
- **Type definitions** - `navigate type` command not yet available
- **Implementations** - `navigate impl` command not yet available
- **Refactoring** - `refactor` commands not yet available
- **Code actions** - Quick fixes not being generated despite `--fix` flag
- **Complexity analysis** - `analyze complexity` command not yet available

### Known Issues
- **Development mode** - May vary by environment; use built CLI if issues arise

### Current Workarounds
- Use `node dist/cli.js` instead of `pnpm run dev` for testing
- Use `configure --print` to see projects instead of `list`
- Check diagnostics manually instead of relying on auto-fixes

These use cases demonstrate the current capabilities of `lsp-top` v0.9. While some advanced features are still in development, the tool already provides valuable command-line access to LSP functionality for both human developers and AI agents.
