const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validateRegister(body) {
  const errors = [];
  const name = String(body.name || '').trim().slice(0, 100);
  const email = cleanEmail(body.email).slice(0, 254);
  const password = String(body.password || '');

  if (!name) errors.push('Name is required');
  if (name.length > 100) errors.push('Name must be at most 100 characters');
  if (!EMAIL_RE.test(email)) errors.push('A valid email is required');
  if (email.length > 254) errors.push('Email must be at most 254 characters');
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (password.length > 128) errors.push('Password must be at most 128 characters');

  return { errors, value: { name, email, password } };
}

function validateLogin(body) {
  const errors = [];
  const email = cleanEmail(body.email);
  const password = String(body.password || '');

  if (!EMAIL_RE.test(email)) errors.push('A valid email is required');
  if (!password) errors.push('Password is required');

  return { errors, value: { email, password } };
}

module.exports = { validateRegister, validateLogin };