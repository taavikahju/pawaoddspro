// Add custom properties to Express Request
declare namespace Express {
  export interface Request {
    fileValidationError?: string;
  }
}