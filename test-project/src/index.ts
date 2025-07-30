import { Calculator } from './calculator';
import { UserService } from './services/user.service';
import { Logger } from './utils/logger';
import { User, UserRole } from './types/user';

// This import is unused
import { unusedFunction } from './utils/helpers';

const calculator = new Calculator();
const userService = new UserService();
const logger = new Logger();

// Example with type error - missing required property
const user: User = {
  id: 1,
  name: 'John Doe',
  // email is missing - this will cause a type error
  role: UserRole.Admin
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
