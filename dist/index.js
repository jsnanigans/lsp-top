"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const calculator_1 = require("./calculator");
const user_service_1 = require("./services/user.service");
const logger_1 = require("./utils/logger");
const user_1 = require("./types/user");
const calculator = new calculator_1.Calculator();
const userService = new user_service_1.UserService();
const logger = new logger_1.Logger();
// Example with type error - missing required property
const user = {
    id: 1,
    name: 'John Doe',
    // email is missing - this will cause a type error
    role: user_1.UserRole.Admin
};
function main() {
    logger.info('Application started');
    // Test calculator
    const result = calculator.add(5, 3);
    console.log(`5 + 3 = ${result}`);
    // Test user service
    const users = userService.getAllUsers();
    console.log(`Found ${users.length} users`);
    // Intentional error: calling method that doesn't exist
    calculator.subtract(10, 5);
}
main();
