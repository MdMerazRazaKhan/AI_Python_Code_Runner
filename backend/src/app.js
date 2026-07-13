const express = require('express');
const cors = require('cors');
const aiRoutes = require('./routes/ai.routes');
const runRoutes = require('./routes/run.routes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes mounting
app.use('/api/ai', aiRoutes);
app.use('/api/run', runRoutes);

// Base route to check API status
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// Fallback Route (404 Not Found)
app.use((req, res, next) => {
  res.status(404).json({ success: false, error: 'Endpoint not found.' });
});

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'An unexpected server error occurred.'
  });
});

module.exports = app;
