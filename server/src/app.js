const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const config = require('./config');
const routes = require('./routes');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const cryptoRoutes = require('./routes/crypto');
const usersRoutes = require('./routes/users');
const conversationsRoutes = require('./routes/conversations');
const messagesRoutes = require('./routes/messages');
const filesRoutes = require('./routes/files');

const app = express();

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.clientOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
}));
app.use(express.json());

if (config.env === 'development') {
  app.use(morgan('dev'));
}

app.use('/api', routes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/files', filesRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = typeof err.status === 'number' && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status !== 413) console.error(err);
  if (status === 413) return res.status(413).json({ error: 'Payload too large' });
  return res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
