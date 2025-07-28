"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const user_1 = require("../types/user");
const logger_1 = require("../utils/logger");
class UserService {
    constructor() {
        this.users = [];
        this.nextId = 1;
        this.logger = new logger_1.Logger();
        this.initializeTestData();
    }
    initializeTestData() {
        this.users = [
            {
                id: this.nextId++,
                name: 'Alice Johnson',
                email: 'alice@example.com',
                role: user_1.UserRole.Admin,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: this.nextId++,
                name: 'Bob Smith',
                email: 'bob@example.com',
                role: user_1.UserRole.User,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];
    }
    getAllUsers() {
        this.logger.info('Fetching all users');
        return [...this.users];
    }
    getUserById(id) {
        return this.users.find(user => user.id === id);
    }
    createUser(dto) {
        const newUser = {
            id: this.nextId++,
            ...dto,
            role: dto.role || user_1.UserRole.User,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.users.push(newUser);
        this.logger.info(`Created user: ${newUser.name}`);
        return newUser;
    }
    updateUser(id, dto) {
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
    deleteUser(id) {
        const index = this.users.findIndex(user => user.id === id);
        if (index === -1) {
            return false;
        }
        this.users.splice(index, 1);
        return true;
    }
}
exports.UserService = UserService;
