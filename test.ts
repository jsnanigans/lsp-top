// TypeScript file with errors for testing
function add(a: number, b: string): number {
  return a + b; // Type error: can't add number and string
}

const result = add(5, "hello");

// Another error: using undefined variable
console.log(undefinedVariable);

// Type mismatch
const numberVar: number = "this is a string";