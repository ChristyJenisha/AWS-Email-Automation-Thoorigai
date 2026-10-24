import type { Request } from 'express';
import type { AppUser } from './auth.service.js';

export interface AuthedRequest extends Request {
  user: AppUser;
}
