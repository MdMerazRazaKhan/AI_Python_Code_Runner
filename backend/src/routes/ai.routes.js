const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');

router.post('/generate', aiController.generateCode);
router.post('/fix', aiController.fixCode);
router.get('/config/status', aiController.getApiKeyStatus);
router.post('/config/save', aiController.saveApiKey);

module.exports = router;
