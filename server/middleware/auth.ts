import { Request, Response, NextFunction } from 'express';
import { User } from '@shared/schema';

// Define middleware to check if user is authenticated
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  
  return res.status(401).json({ error: "Unauthorized: Please log in" });
}

// Define middleware to check if user is an admin
export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized: Please log in" });
  }
  
  const user = req.user as User;
  
  if (user.role !== 'admin') {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  
  return next();
}