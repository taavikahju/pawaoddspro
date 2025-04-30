// Simple in-memory storage implementation
const createMemoryStore = require('memorystore');
const session = require('express-session');

const MemoryStore = createMemoryStore(session);

// Basic in-memory storage
class MemStorage {
  constructor() {
    this.users = new Map();
    this.bookmakerData = new Map();
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  // User methods
  async getUser(id) {
    return this.users.get(id);
  }

  async getUserByUsername(username) {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser) {
    const id = Date.now();
    const user = { id, ...insertUser };
    this.users.set(id, user);
    return user;
  }

  // Bookmaker data methods
  async saveBookmakerData(bookmakerCode, events) {
    this.bookmakerData.set(bookmakerCode, {
      events,
      timestamp: new Date().toISOString()
    });
    return true;
  }

  async getBookmakerData(bookmakerCode) {
    return this.bookmakerData.get(bookmakerCode) || { events: [], timestamp: null };
  }

  async getAllBookmakers() {
    return Array.from(this.bookmakerData.keys()).map(code => ({
      code,
      ...this.bookmakerData.get(code)
    }));
  }
}

const storage = new MemStorage();

module.exports = {
  storage
};