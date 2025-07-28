"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Calculator = void 0;
/**
 * A simple calculator class for basic arithmetic operations
 */
class Calculator {
    /**
     * Adds two numbers together
     * @param a First number
     * @param b Second number
     * @returns The sum of a and b
     */
    add(a, b) {
        return a + b;
    }
    /**
     * Multiplies two numbers
     * @param a First number
     * @param b Second number
     * @returns The product of a and b
     */
    multiply(a, b) {
        return a * b;
    }
    /**
     * Divides two numbers
     * @param a Dividend
     * @param b Divisor
     * @returns The quotient of a divided by b
     * @throws Error if b is zero
     */
    divide(a, b) {
        if (b === 0) {
            throw new Error('Division by zero');
        }
        return a / b;
    }
}
exports.Calculator = Calculator;
