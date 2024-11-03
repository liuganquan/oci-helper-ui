const express = require('express');
const router = express.Router();
const OciConfig = require('../models/ociConfig');

router.post('/', async (req, res) => {
    try {
        const id = await OciConfig.create(req.body);
        res.json({ id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const configs = await OciConfig.findAll();
        res.json(configs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const config = await OciConfig.findById(req.params.id);
        if (!config) {
            return res.status(404).json({ error: '配置不存在' });
        }
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await OciConfig.delete(req.params.id);
        res.json({ message: '配置已删除' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 