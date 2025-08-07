# Known Issues

This document tracks known bugs and limitations in LSP-Top v0.9.0.

## 🐛 Bugs

### 1. `list` Command Doesn't Display Projects
**Issue**: The `list` command exits before displaying project list  
**Location**: `src/cli.ts:286`  
**Problem**: Calls `printTextAndExit()` which exits immediately, preventing subsequent `console.log` statements from executing  
**Workaround**: Use `lsp-top configure --print` to see all projects  
**Fix**: Remove `printTextAndExit` call and just use `console.log`

### 2. Development Mode Broken (`pnpm run dev`)
**Issue**: `__dirname is not defined in ES module scope` error  
**Location**: `src/cli.ts:58`  
**Problem**: TypeScript compiles to CommonJS but tsx runs as ES modules  
**Workaround**: Use built version: `node dist/cli.js <command>`  
**Fix**: Use `import.meta.url` or configure tsx to use CommonJS

### 3. Code Fixes Not Generated
**Issue**: `--fix` flag doesn't produce any code actions  
**Problem**: Code actions request may not be implemented or incorrectly configured  
**Affected Commands**: 
- `lsp-top inspect <alias> file <path> --fix`
- `lsp-top inspect <alias> file <path> --fix-dry`
**Workaround**: Manually fix issues based on diagnostics

## ⚠️ Limitations

### Commands Not Yet Implemented
Despite being documented, these commands are not yet functional:

#### Navigation
- `explore hover` - Get type information and documentation
- `navigate type` - Go to type definition
- `navigate impl` - Find implementations
- `navigate symbol` - Search symbols by name

#### Refactoring
- `refactor rename` - Rename symbols across project
- `refactor extract-function` - Extract code to function
- `refactor organize-imports` - Organize import statements
- `refactor format` - Format code

#### Analysis
- `analyze unused` - Find unused code
- `analyze complexity` - Measure code complexity
- `search text` - Text search
- `search symbol` - Symbol search

### Partial Implementations
- **Inspect command**: Only shows diagnostics, doesn't generate fixes
- **Edit commands**: `apply` and `plan` exist but may not work correctly

## 📝 Documentation Inconsistencies

### README vs Implementation
- README shows commands that don't exist yet (marked as "coming in v1.0")
- Some examples use non-existent commands
- JSON output schemas not fully documented

### Command Help vs Actual Behavior
- Help text may show options that don't work
- Some flags are accepted but have no effect

## 🔧 Recommended Fixes Priority

### High Priority (Breaking Issues)
1. Fix `list` command output
2. Fix development mode (`pnpm run dev`)
3. Implement code actions for `--fix` flag

### Medium Priority (User Experience)
1. Better error messages with suggestions
2. Human-readable output formatting
3. Progress indicators for long operations
4. Consistent command structure

### Low Priority (Nice to Have)
1. Implement remaining navigation commands
2. Add refactoring capabilities
3. Symbol-based navigation
4. Complexity analysis

## 💡 Workarounds Summary

| Issue | Workaround |
|-------|------------|
| Can't see project list | Use `configure --print` |
| Dev mode broken | Use `node dist/cli.js` |
| No code fixes | Manually fix based on diagnostics |
| No hover info | Check diagnostics for type errors |
| No refactoring | Make changes manually |

## 🚀 Testing Commands

```bash
# Build and test
pnpm run build
node dist/cli.js --help

# Initialize test project
node dist/cli.js init test ./test-project

# Start daemon
node dist/cli.js start-server

# Test navigation
node dist/cli.js run test definition src/calculator.ts:11:3
node dist/cli.js run test references src/calculator.ts:4:14

# Test diagnostics
node dist/cli.js run test diagnostics src/index.ts

# Test inspection
node dist/cli.js inspect test file src/index.ts

# Check configuration
node dist/cli.js configure --print

# Check daemon status
node dist/cli.js metrics
```

## 📊 Version Status

**Current Version**: 0.9.0  
**Working Features**: ~40% of planned functionality  
**Target for v1.0**: Full navigation, refactoring, and analysis capabilities

---

*Last updated: Testing performed on the current implementation*