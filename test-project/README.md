# Test Project for LSP-MCP

This is a test TypeScript project designed to demonstrate and test the LSP-MCP server capabilities.

## Features to Test

### 1. Type Errors
- Missing required property in `src/index.ts` (line 14-18)
- Method doesn't exist error in `src/index.ts` (line 32)

### 2. Unused Imports
- Unused import in `src/index.ts` (line 7)

### 3. Code Organization
- Multiple imports that can be organized
- Unused imports that can be removed

### 4. Symbol Analysis
- Classes: `Calculator`, `UserService`, `Logger`
- Interfaces: `User`, `CreateUserDto`, `UpdateUserDto`
- Enums: `UserRole`, `LogLevel`
- Functions: Various methods across classes

### 5. File References
- `Calculator` is imported and used in `index.ts`
- `User` types are imported in multiple files
- Test files reference implementation files

## Testing the MCP Tools

### Initialize Project
```json
{
  "workspaceRoot": "/path/to/lsp-mcp/test-project"
}
```

### Analyze Symbols
Try analyzing different symbols:
- Class: `Calculator` at `src/calculator.ts:5:14`
- Interface: `User` at `src/types/user.ts:7:18`
- Method: `add` at `src/calculator.ts:10:3`

### Get Structure
```json
{
  "file": "/path/to/lsp-mcp/test-project/src/calculator.ts"
}
```

### Improve Code
Fix the issues in index.ts:
```json
{
  "file": "/path/to/lsp-mcp/test-project/src/index.ts",
  "actions": ["remove_unused", "organize_imports"]
}
```