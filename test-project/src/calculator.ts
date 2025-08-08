/**
 * A simple calculator class for basic arithmetic operations
 */
export class Calculator {
  /**
   * Adds two numbers together
   * @param a First number
   * @param b Second number
   * @returns The sum of a and b
   */
  add(a: number, b: number): number {
    // Simple addition
    return a + b;
  }

  /**
   * Multiplies two numbers
   * @param a First number
   * @param b Second number
   * @returns The product of a and b
   */
  multiply(a: number, b: number): number {
    return a * b;
  }

  /**
   * Divides two numbers
   * @param a Dividend
   * @param b Divisor
   * @returns The quotient of a divided by b
   * @throws Error if b is zero
   */
  divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error('Division by zero');
    }
    return a / b;
  }

  // Note: subtract method is referenced in index.ts but not implemented
}