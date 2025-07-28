import { User, CreateUserDto, UpdateUserDto, UserRole } from '../types/user';
import { Logger } from '../utils/logger';

export class UserService {
  private users: User[] = [];
  private logger: Logger;
  private nextId = 1;

  constructor() {
    this.logger = new Logger();
    this.initializeTestData();
  }

  private initializeTestData(): void {
    this.users = [
      {
        id: this.nextId++,
        name: 'Alice Johnson',
        email: 'alice@example.com',
        role: UserRole.Admin,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: this.nextId++,
        name: 'Bob Smith',
        email: 'bob@example.com',
        role: UserRole.User,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  getAllUsers(): User[] {
    this.logger.info('Fetching all users');
    return [...this.users];
  }

  getUserById(id: number): User | undefined {
    return this.users.find(user => user.id === id);
  }

  createUser(dto: CreateUserDto): User {
    const newUser: User = {
      id: this.nextId++,
      ...dto,
      role: dto.role || UserRole.User,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.users.push(newUser);
    this.logger.info(`Created user: ${newUser.name}`);
    return newUser;
  }

  updateUser(id: number, dto: UpdateUserDto): User | undefined {
    const index = this.users.findIndex(user => user.id === id);
    if (index === -1) {
      return undefined;
    }

    this.users[index] = {
      ...this.users[index],
      ...dto,
      updatedAt: new Date()
    };

    return this.users[index];
  }

  deleteUser(id: number): boolean {
    const index = this.users.findIndex(user => user.id === id);
    if (index === -1) {
      return false;
    }

    this.users.splice(index, 1);
    return true;
  }
}