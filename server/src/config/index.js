module.exports = {
  port: process.env.PORT || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  clientOrigins: process.env.CLIENT_ORIGINS
    ? process.env.CLIENT_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : [...new Set([process.env.CLIENT_URL || 'http://localhost:3000', 'http://localhost:3000'])],
  env: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },
};
