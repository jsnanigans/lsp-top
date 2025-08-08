# Implementation Plan: Unix-Compatible Command Refactor

## Overview
Complete refactor of lsp-top to follow Unix philosophy and enable command chaining/piping.

## Key Changes

### 1. Output Format (Default: TSV)
```
file	line	column	type	details...
```

### 2. Command Structure (Flat)
```bash
# Old: lsp-top navigate def src/foo.ts:10:5
# New: lsp-top def src/foo.ts:10:5

# Old: lsp-top explore hover src/foo.ts:10:5  
# New: lsp-top hover src/foo.ts:10:5

# Old: lsp-top analyze file src/foo.ts
# New: lsp-top check src/foo.ts
```

### 3. Consistent Options
```bash
--format tsv|csv|json|compact  # Output format
--delimiter <char>              # Field separator
--no-headers                    # Omit column headers
-v, --verbose                   # Add context lines
-q, --quiet                     # Errors only
```

## File Changes Required

### New Files
1. `src/unix-formatter.ts` - New output formatter
2. `src/position-parser.ts` - Unified position parsing

### Modified Files
1. `src/cli.ts` - Flatten commands, use new formatter
2. `src/output-formatter.ts` - Replace with unix-formatter calls
3. All test files - Update expected outputs

## Implementation Order

### Phase 1: Core Infrastructure (Day 1)
- [ ] Create `unix-formatter.ts`
- [ ] Create `position-parser.ts`
- [ ] Add format option to global CLI options

### Phase 2: Command Refactor (Day 2)
- [ ] Flatten command structure in `cli.ts`
- [ ] Update all command handlers to use new formatter
- [ ] Remove nested command groups

### Phase 3: Output Cleanup (Day 3)
- [ ] Remove all emoji usage
- [ ] Remove box drawing characters
- [ ] Standardize error messages

### Phase 4: Testing (Day 4)
- [ ] Update all test expectations
- [ ] Add piping tests
- [ ] Verify JSON output consistency

## Command Mapping

| Old Command | New Command | Notes |
|------------|-------------|-------|
| `navigate def` | `def` | |
| `navigate refs` | `refs` | |
| `navigate type` | `type` | |
| `navigate impl` | `impl` | |
| `explore hover` | `hover` | |
| `explore symbols` | `symbols` | |
| `explore outline` | `outline` | |
| `explore project-symbols` | `search` | |
| `explore call-hierarchy` | `calls` | |
| `explore type-hierarchy` | `types` | |
| `analyze file` | `check` | |
| `analyze changed` | `check-changed` | |
| `analyze project` | `check-all` | |
| `refactor rename` | `rename` | |
| `refactor organize-imports` | `organize` | |

## Output Examples

### Definition
```bash
$ lsp-top def src/foo.ts:10:5
src/types/user.ts	5	14	definition	interface User
```

### References
```bash
$ lsp-top refs src/foo.ts:10:5
src/index.ts	10	5	reference	import
src/service.ts	23	15	reference	parameter
src/service.ts	45	8	reference	return
```

### Diagnostics
```bash
$ lsp-top check src/foo.ts
src/foo.ts	10	5	error	TS2322	Type 'string' not assignable to 'number'
src/foo.ts	23	1	warning	TS6133	'x' is declared but never used
```

### With Verbose Context
```bash
$ lsp-top def src/foo.ts:10:5 -v
src/types/user.ts	5	14	definition	interface User
  3 | import { BaseModel } from './base';
  4 |
> 5 | export interface User extends BaseModel {
  6 |   name: string;
  7 |   email: string;
```

## Testing Strategy

### Unit Tests
- Test each formatter function independently
- Test position parser with various inputs
- Test error handling

### Integration Tests
- Test command output format
- Test piping between commands
- Test JSON consistency

### Example Test Cases
```bash
# Pipe refs to def
lsp-top refs src/foo.ts:10:5 | head -1 | cut -f1-3 | xargs -I {} lsp-top def {}

# Filter errors only
lsp-top check src/foo.ts | grep "error"

# Count by type
lsp-top symbols src/foo.ts | cut -f4 | sort | uniq -c
```

## Success Criteria

1. All commands produce consistent TSV output by default
2. Any command output can be piped to another command
3. JSON output has consistent schema across all commands
4. No decorative characters in default output
5. All tests pass with new format
6. Documentation updated with examples

## Notes

- No backwards compatibility needed (unreleased)
- No migration path required
- Can break any existing patterns
- Focus on simplicity and Unix compatibility