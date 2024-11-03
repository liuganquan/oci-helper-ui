const express = require('express');
const router = express.Router();
const GlobalConfig = require('../models/globalConfig');
const autoGrabService = require('../services/AutoGrabService');

router.get('/global', async (req, res) => {
    try {
        const config = await GlobalConfig.get();
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: '获取配置失败' });
    }
});

router.post('/global', async (req, res) => {
    try {
        await GlobalConfig.update(req.body);
        
        if (req.body.auto_grab_enabled) {
            await autoGrabService.init();
        } else {
            // 关闭服务
            await autoGrabService.close();
        }
        
        res.json({ message: '配置更新成功' });
    } catch (error) {
        console.error('更新配置失败', error);
        res.status(500).json({ error: '更新配置失败' });
    }
});

module.exports = router; 