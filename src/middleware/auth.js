/**
 * Authentication middleware.
 */

/**
 * Require an authenticated user session.
 * Expects req.session.user to be set by login/register routes.
 */
export function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

/**
 * Require admin session.
 * Expects req.session.admin to be true (set by admin login).
 */
export function requireAdmin(req, res, next) {
  if (!req.session?.admin) {
    return res.status(403).json({ error: 'Forbidden: admin access required' });
  }
  next();
}
