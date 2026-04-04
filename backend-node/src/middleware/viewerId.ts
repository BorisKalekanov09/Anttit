import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      viewerId: string;
    }
  }
}

/**
 * Parse cookies from raw Cookie header without cookie-parser dependency.
 * Returns a map of cookie name => value.
 */
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const [name, value] = pair.split('=');
    if (name && value) {
      cookies[name.trim()] = decodeURIComponent(value.trim());
    }
  }
  return cookies;
}

export function viewerIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Try to get viewerId from X-Viewer-Id header first
  let viewerId = req.get('X-Viewer-Id');

  // If not in header, try to parse from cookies (no cookie-parser needed)
  if (!viewerId) {
    const cookies = parseCookies(req.get('Cookie'));
    viewerId = cookies.viewer_id;
  }

  // If still no viewerId, generate a new UUID
  if (!viewerId) {
    viewerId = randomUUID();
    res.cookie('viewer_id', viewerId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });
  }

  // Attach viewerId to request and strip any body.viewerId overrides
  req.viewerId = viewerId;
  if (req.body && typeof req.body === 'object' && 'viewerId' in req.body) {
    delete req.body.viewerId;
  }

  next();
}
