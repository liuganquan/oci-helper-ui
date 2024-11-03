const express = require('express');
const router = express.Router();
const grabController = require('../controllers/grabController');
const GrabTask = require('../models/grabTask');
const db = require('../database/db');
const OciConfig = require('../models/ociConfig');
const InstanceController = require('../controllers/instanceController');
const grabService = require('../services/GrabService');

// 创建抢机任务
router.post('/tasks', async (req, res) => {
    try {
        const taskData = req.body;
        
        // 获取配置信息
        const config = await OciConfig.findById(taskData.profile_id);
        if (!config) {
            return res.status(404).json({ error: '配置不存在' });
        }

        // 获取或创建子网
        const instanceController = new InstanceController(config);
        const subnetId = await instanceController.getOrCreateSubnet();

        // 创建任务时包含子网ID
        const taskId = await GrabTask.create({
            ...taskData,
            subnet_id: subnetId,
            status: 'stopped'
        });

        res.json({ id: taskId });
    } catch (error) {
        console.error('创建任务失败:', error);
        res.status(500).json({ error: '创建任务失败' });
    }
});

// 获取任务列表
router.get('/tasks', async (req, res) => {
    try {
        const tasks = await GrabTask.findAll();
        res.json(tasks);
    } catch (error) {
        console.error('获取任务列表失败:', error);
        res.status(500).json({ error: '获取任务列表失败' });
    }
});

// 获取单个任务
router.get('/tasks/:id', async (req, res) => {
    try {
        const task = await GrabTask.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }
        res.json(task);
    } catch (error) {
        console.error('获取任务失败:', error);
        res.status(500).json({ error: '获取任务失败' });
    }
});

// 开始任务
router.post('/tasks/:id/start', async (req, res) => {
    try {
        const task = await GrabTask.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }
        
        await grabController.startTask(req.params.id);
        res.json({ message: '任务已启动' });
    } catch (error) {
        console.error('启动任务失败:', error);
        res.status(500).json({ error: '启动任务失败: ' + error.message });
    }
});

// 停止任务
router.post('/tasks/:id/stop', async (req, res) => {
    try {
        const task = await GrabTask.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }

        await grabController.stopTask(req.params.id);
        res.json({ message: '任务已停止' });
    } catch (error) {
        console.error('停止任务失败:', error);
        res.status(500).json({ error: '停止任务失败: ' + error.message });
    }
});

// 获取任务日志
router.get('/tasks/:id/logs', async (req, res) => {
    try {
        const logs = await GrabTask.getLogs(req.params.id);
        res.json(logs);
    } catch (error) {
        console.error('获取任务日志失败:', error);
        res.status(500).json({ error: '获取任务日志失败' });
    }
});

// 删除任务
router.delete('/tasks/:id', async (req, res) => {
    try {
        const task = await GrabTask.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }
        
        if (task.status === 'running') {
            return res.status(400).json({ error: '无法删除正在运行的任务' });
        }

        await GrabTask.delete(req.params.id);
        res.json({ message: '任务删除成功' });
    } catch (error) {
        console.error('删除任务失败:', error);
        res.status(500).json({ error: '删除任务失败' });
    }
});

// 获取实例信息
router.get('/tasks/:id/instance', async (req, res) => {
    try {
        const task = await GrabTask.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }
        
        if (!task.instance_id) {
            return res.status(404).json({ error: '实例未创建' });
        }

        res.json({
            instance_id: task.instance_id,
            public_ip: task.instance_ip,
            password: task.instance_password,
            auth_type: task.auth_type
        });
    } catch (error) {
        console.error('获取实例信息失败:', error);
        res.status(500).json({ error: '获取实例信息失败' });
    }
});



module.exports = router; 