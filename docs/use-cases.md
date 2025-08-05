# LSP-Top Use Cases

## For Human Developers

### 1. Command-Line Only Development

**Scenario**: SSH'd into a remote server, no GUI available

```bash
# Understand what a function does
lsp-top explore hover src/api.ts:45:10

# Find where it's defined
lsp-top navigate def src/api.ts:45:10

# See all places it's used
lsp-top navigate refs src/api.ts:45:10 --context 3

# Fix issues before committing
lsp-top analyze file src/api.ts --fix

# Safely rename across project
lsp-top refactor rename src/old.ts:10:5 "betterName" --preview
```

### 2. Quick Code Verification

**Scenario**: Just edited a file, want to verify it's correct

```bash
# Check for type errors
lsp-top analyze file src/service.ts

# Verify imports are correct
lsp-top refactor organize-imports src/service.ts

# Format code
lsp-top refactor format src/service.ts
```

### 3. Code Review from Terminal

**Scenario**: Reviewing PR changes without IDE

```bash
# Check all changed files
lsp-top analyze changed --since main

# Understand what a changed function does
lsp-top explore hover src/new-feature.ts:30:15

# See where new function is called
lsp-top navigate refs src/new-feature.ts:30:15
```

### 4. Exploring Unknown Codebase

**Scenario**: New to a project, need to understand structure

```bash
# See what's in a file
lsp-top explore symbols src/core.ts --tree

# Find main entry points
lsp-top navigate symbol "main" --kind function

# Understand key interfaces
lsp-top navigate symbol "Config" --kind interface
lsp-top explore hover src/types.ts:ConfigInterface:1:1

# Trace through call hierarchy
lsp-top navigate calls src/app.ts:bootstrap:10:5 --direction out
```

### 5. Refactoring Without IDE

**Scenario**: Need to clean up code from command line

```bash
# Find unused exports
lsp-top analyze unused --type exports

# Rename across project
lsp-top refactor rename src/utils.ts:oldFunc:5:10 "newFunc"

# Extract repeated code
lsp-top refactor extract-function src/long.ts:50-75 "handleUserData"

# Move function to different file
lsp-top refactor move src/utils.ts:helperFunc src/helpers.ts
```

## For AI Agents

### 1. Automated Code Analysis

**Use Case**: AI analyzing codebase for improvements

```python
# AI agent script
import subprocess
import json

def analyze_project():
    # Get all TypeScript files
    files = subprocess.run(
        ["find", ".", "-name", "*.ts"],
        capture_output=True,
        text=True
    ).stdout.strip().split('\n')
    
    issues = []
    for file in files:
        # Check each file
        result = subprocess.run(
            ["lsp-top", "analyze", "file", file, "--json"],
            capture_output=True,
            text=True
        )
        data = json.loads(result.stdout)
        if data["diagnostics"]:
            issues.append({
                "file": file,
                "issues": data["diagnostics"]
            })
    
    return issues
```

### 2. Intelligent Code Navigation

**Use Case**: AI understanding code relationships

```python
def understand_function(file_pos):
    # Get function info
    hover = run_lsp_top(f"explore hover {file_pos} --json")
    
    # Find all usages
    refs = run_lsp_top(f"navigate refs {file_pos} --json")
    
    # Get implementation details
    impl = run_lsp_top(f"navigate impl {file_pos} --json")
    
    return {
        "documentation": hover["data"]["contents"],
        "references": refs["data"]["locations"],
        "implementations": impl["data"]["locations"]
    }
```

### 3. Automated Refactoring

**Use Case**: AI performing safe code transformations

```python
def safe_rename(old_pos, new_name):
    # Preview changes
    preview = run_lsp_top(
        f"refactor rename {old_pos} {new_name} --preview --json"
    )
    
    # Analyze impact
    affected_files = len(preview["data"]["documentChanges"])
    
    if affected_files < 10:  # Safe threshold
        # Apply rename
        result = run_lsp_top(
            f"refactor rename {old_pos} {new_name} --json"
        )
        return result
    else:
        return {"error": "Too many files affected", "count": affected_files}
```

### 4. Code Generation Assistant

**Use Case**: AI generating code with context

```python
def generate_implementation(interface_file):
    # Find interface definition
    symbols = run_lsp_top(
        f"explore symbols {interface_file} --kind interface --json"
    )
    
    for symbol in symbols["data"]:
        # Get interface details
        hover = run_lsp_top(
            f"explore hover {interface_file}:{symbol['line']}:{symbol['col']} --json"
        )
        
        # Generate implementation based on interface
        implementation = generate_from_interface(hover["data"])
        
        # Verify generated code
        verify_result = verify_implementation(implementation)
```

### 5. Continuous Code Quality

**Use Case**: AI monitoring code quality

```python
def monitor_code_quality():
    while True:
        # Check changed files
        changed = run_lsp_top("analyze changed --json")
        
        for file in changed["data"]["files"]:
            # Analyze complexity
            complexity = run_lsp_top(f"analyze complexity {file} --json")
            
            if complexity["data"]["cyclomatic"] > 10:
                # Suggest refactoring
                suggest_refactor(file, complexity)
            
            # Check for unused code
            unused = run_lsp_top(f"analyze unused --file {file} --json")
            if unused["data"]["items"]:
                cleanup_unused(unused["data"]["items"])
```

## Integration Patterns

### 1. Git Hooks

```bash
#!/bin/bash
# pre-commit hook

# Check all staged files
lsp-top analyze changed --staged --json > analysis.json

if [ $(jq '.data.errorCount' analysis.json) -gt 0 ]; then
    echo "Errors found in staged files:"
    lsp-top analyze changed --staged
    exit 1
fi

# Auto-fix issues
lsp-top analyze changed --staged --fix

# Organize imports
for file in $(git diff --cached --name-only | grep '\.ts$'); do
    lsp-top refactor organize-imports "$file"
done
```

### 2. CI/CD Pipeline

```yaml
# GitHub Actions example
- name: Code Quality Check
  run: |
    lsp-top analyze changed --since ${{ github.base_ref }} --json > analysis.json
    
    ERROR_COUNT=$(jq '.data.errorCount' analysis.json)
    if [ $ERROR_COUNT -gt 0 ]; then
      echo "::error::Found $ERROR_COUNT errors"
      lsp-top analyze changed --since ${{ github.base_ref }}
      exit 1
    fi

- name: Check Unused Code
  run: |
    lsp-top analyze unused --type exports --json > unused.json
    UNUSED_COUNT=$(jq '.data.items | length' unused.json)
    echo "::warning::Found $UNUSED_COUNT unused exports"
```

### 3. Editor Integration

```vim
" Vim integration
function! LspTopHover()
  let pos = line('.') . ':' . col('.')
  let file = expand('%:p')
  let cmd = 'lsp-top explore hover ' . file . ':' . pos
  let result = system(cmd)
  echo result
endfunction

nnoremap K :call LspTopHover()<CR>
```

### 4. Shell Aliases

```bash
# Useful aliases
alias lsp-def='lsp-top navigate def'
alias lsp-refs='lsp-top navigate refs'
alias lsp-hover='lsp-top explore hover'
alias lsp-check='lsp-top analyze file'
alias lsp-fix='lsp-top analyze file --fix'

# Quick navigation function
function goto() {
  local result=$(lsp-top navigate def "$1" --json | jq -r '.data.location.uri')
  local file=${result#file://}
  local line=$(lsp-top navigate def "$1" --json | jq -r '.data.location.range.start.line')
  vim "+$((line + 1))" "$file"
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

# Navigate to error location from logs
lsp-top navigate def src/api.ts:processOrder:45:10

# Understand the function
lsp-top explore hover src/api.ts:45:10

# Find all calls to this function
lsp-top navigate refs src/api.ts:45:10 --context 5

# Check for recent changes
git log -p src/api.ts | head -50
```

### 2. Large-Scale Refactoring
```bash
# Find all uses of deprecated API
lsp-top navigate refs src/deprecated.ts:oldAPI:10:5 > usage.txt

# Generate migration script
for location in $(cat usage.txt | grep -o '[^:]*:[0-9]*:[0-9]*'); do
  echo "Migrating $location"
  lsp-top refactor codeaction "$location" --apply migrate-to-new-api
done
```

### 3. Code Review Automation
```bash
# AI agent reviewing PR
for file in $(git diff --name-only main...HEAD | grep '\.ts$'); do
  # Check complexity
  complexity=$(lsp-top analyze complexity "$file" --json | jq '.data.max')
  if [ "$complexity" -gt 15 ]; then
    echo "::warning file=$file::High complexity: $complexity"
  fi
  
  # Check for common issues
  lsp-top analyze file "$file" --json | \
    jq -r '.data.diagnostics[] | 
    "::warning file=\(.file),line=\(.range.start.line)::\(.message)"'
done
```

These use cases demonstrate how `lsp-top` bridges the gap between command-line tools and IDE functionality, enabling both human developers and AI agents to work effectively with codebases in ways that weren't previously possible.