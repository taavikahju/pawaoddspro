import { Request, Response, NextFunction } from 'express';

// Simple admin auth middleware that uses an env variable
export function simpleAdminAuth(req: Request, res: Response, next: NextFunction) {
  const providedKey = req.headers['x-admin-key'] as string;
  const adminKey = process.env.ADMIN_KEY || 'default-admin-key';
  
  if (!providedKey || providedKey !== adminKey) {
    return res.status(401).json({ 
      success: false, 
      message: 'Unauthorized: Admin access required' 
    });
  }

  next();
}