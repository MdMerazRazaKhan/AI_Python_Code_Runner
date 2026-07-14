const express = require('express');
const router = express.Router();
const runController = require('../controllers/run.controller');

router.post('/execute', runController.executeCode);
router.get('/history', runController.getHistory);
router.post('/history', runController.createHistoryItem);
router.delete('/history', runController.clearHistory);
router.delete('/history/:id', runController.deleteHistoryItem);
router.put('/history/:id', runController.updateHistoryItem);

module.exports = router;
