const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const config = require('./config');
const routes = require('./routes');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const cryptoRoutes = require('./routes/crypto');

const app = express();

app.use(helmet());
app.use(cors({ origin: config.clientUrl }));
app.use(express.json());

if (config.env === 'development') {
  app.use(morgan('dev'));
}

app.use('/api', routes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/crypto', cryptoRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
