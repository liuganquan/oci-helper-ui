const express = require('express');
const router = express.Router();
const InstanceController = require('../controllers/instanceController');
const OciConfig = require('../models/ociConfig');

// 获取实例列表
router.get('/', async (req, res) => {
    try {
        const { profile_id } = req.query;
        if (!profile_id) {
            return res.status(400).json({ error: '未提供配置ID' });
        }

        const config = await OciConfig.findById(profile_id);
        if (!config) {
            return res.status(400).json({ error: '未找到配置信息' });
        }

        const instanceController = new InstanceController(config);
        const instances = await instanceController.listInstances();
        res.json(instances);
    } catch (error) {
        console.error('获取实例列表失败:', error);
        res.status(500).json({ error: '获取实例列表失败' });
    }
});

// 获取预设实例类型列表
router.get('/shapes', async (req, res) => {
    try {
        const { profile_id } = req.query;
        if (!profile_id) {
            return res.status(400).json({ error: '未提供配置ID' });
        }

        const config = await OciConfig.findById(profile_id);
        if (!config) {
            return res.status(400).json({ error: '未找到配置信息' });
        }

        const instanceController = new InstanceController(config);
        const shapes = instanceController.getPresetShapes();
        res.json(shapes);
    } catch (error) {
        console.error('获取实例类型列表失败:', error);
        res.status(500).json({ error: '获取实例类型列表失败' });
    }
});

// 获取可用的镜像
router.get('/images', async (req, res) => {
    try {
        const { shape, profile_id } = req.query;
        if (!shape) {
            return res.status(400).json({ error: '未提供实例类型' });
        }
        if (!profile_id) {
            return res.status(400).json({ error: '未提供配置ID' });
        }

        const config = await OciConfig.findById(profile_id);
        if (!config) {
            return res.status(400).json({ error: '未找到配置信息' });
        }

        const instanceController = new InstanceController(config);
        const images = await instanceController.getImagesForShape(shape);
        res.json(images);
    } catch (error) {
        console.error('获取镜像列表失败:', error);
        res.status(500).json({ error: '获取镜像列表失败' });
    }
});

// 获取可用区列表
router.get('/availability-domains', async (req, res) => {
    try {
        const { profile_id } = req.query;
        if (!profile_id) {
            return res.status(400).json({ error: '未提供配置ID' });
        }

        const config = await OciConfig.findById(profile_id);
        if (!config) {
            return res.status(400).json({ error: '未找到配置信息' });
        }

        const instanceController = new InstanceController(config);
        const availabilityDomains = await instanceController.getAvailabilityDomains();
        res.json(availabilityDomains);
    } catch (error) {
        console.error('获取可用区列表失败:', error);
        res.status(500).json({ error: '获取可用区列表失败' });
    }
});

// 创建实例
router.post('/', async (req, res) => {
    try {
        const { profile_id, ...instanceDetails } = req.body;
        if (!profile_id) {
            return res.status(400).json({ error: '未提供配置ID' });
        }

        const config = await OciConfig.findById(profile_id);
        if (!config) {
            return res.status(400).json({ error: '未找到配置信息' });
        }

        const instanceController = new InstanceController(config);
        const instance = await instanceController.createInstance(instanceDetails);
        res.json(instance);
    } catch (error) {
        console.error('创建实例失败:', error);
        res.status(500).json({ error: '创建实例失败: ' + error.message });
    }
});

// 获取实例状态
router.get('/:instanceId/status', async (req, res) => {
    try {
        const { profile_id } = req.query;
        const { instanceId } = req.params;
        
        if (!profile_id) {
            return res.status(400).json({ error: '未提供配置ID' });
        }

        const config = await OciConfig.findById(profile_id);
        if (!config) {
            return res.status(400).json({ error: '未找到配置信息' });
        }

        const instanceController = new InstanceController(config);
        const status = await instanceController.getInstanceStatus(instanceId);
        res.json({ status });
    } catch (error) {
        console.error('获取实例状态失败:', error);
        res.status(500).json({ error: '获取实例状态失败' });
    }
});

// 终止实例
router.delete('/:instanceId', async (req, res) => {
    try {
        const { profile_id } = req.query;
        const { instanceId } = req.params;
        
        if (!profile_id) {
            return res.status(400).json({ error: '未提供配置ID' });
        }

        const config = await OciConfig.findById(profile_id);
        if (!config) {
            return res.status(400).json({ error: '未找到配置信息' });
        }

        const instanceController = new InstanceController(config);
        await instanceController.terminateInstance(instanceId);
        res.json({ message: '实例已终止' });
    } catch (error) {
        console.error('终止实例失败:', error);
        res.status(500).json({ error: '终止实例失败' });
    }
});

// 获取实例详情
router.get('/:instanceId', async (req, res) => {
    try {
        const { profile_id } = req.query;
        const { instanceId } = req.params;
        
        if (!profile_id) {
            return res.status(400).json({ error: '未提供配置ID' });
        }

        const config = await OciConfig.findById(profile_id);
        if (!config) {
            return res.status(400).json({ error: '未找到配置信息' });
        }

        const instanceController = new InstanceController(config);
        const instance = await instanceController.getInstance(instanceId);
        res.json(instance);
    } catch (error) {
        console.error('获取实例详情失败:', error);
        res.status(500).json({ error: '获取实例详情失败' });
    }
});

// 启动实例
router.post('/:instanceId/start', async (req, res) => {
    try {
        const { profile_id } = req.query;
        const { instanceId } = req.params;
        
        if (!profile_id) {
            return res.status(400).json({ error: '未提供配置ID' });
        }

        const config = await OciConfig.findById(profile_id);
        if (!config) {
            return res.status(400).json({ error: '未找到配置信息' });
        }

        const instanceController = new InstanceController(config);
        await instanceController.startInstance(instanceId);
        res.json({ message: '实例启动成功' });
    } catch (error) {
        console.error('启动实例失败:', error);
        res.status(500).json({ error: '启动实例失败' });
    }
});

// 停止实例
router.post('/:instanceId/stop', async (req, res) => {
    try {
        const { profile_id } = req.query;
        const { instanceId } = req.params;
        
        if (!profile_id) {
            return res.status(400).json({ error: '未提供配置ID' });
        }

        const config = await OciConfig.findById(profile_id);
        if (!config) {
            return res.status(400).json({ error: '未找到配置信息' });
        }

        const instanceController = new InstanceController(config);
        await instanceController.stopInstance(instanceId);
        res.json({ message: '实例停止成功' });
    } catch (error) {
        console.error('停止实例失败:', error);
        res.status(500).json({ error: '停止实例失败' });
    }
});

// 调整实例规格
router.post('/:instanceId/resize', async (req, res) => {
  try {
    const { profile_id, ocpus, memoryInGBs } = req.body;
    const { instanceId } = req.params;
    
    if (!profile_id) {
      return res.status(400).json({ error: '未提供配置ID' });
    }

    const config = await OciConfig.findById(profile_id);
    if (!config) {
      return res.status(400).json({ error: '未找到配置信息' });
    }

    const instanceController = new InstanceController(config);
    await instanceController.resizeInstance(instanceId, { ocpus, memoryInGBs });
    res.json({ message: '实例规格调整成功' });
  } catch (error) {
    console.error('调整实例规格失败:', error);
    res.status(500).json({ error: '调整实例规格失败' });
  }
});

// 更换实例IP
router.post('/:instanceId/change-ip', async (req, res) => {
  try {
    const { profile_id } = req.query;
    const { instanceId } = req.params;
    
    if (!profile_id) {
      return res.status(400).json({ error: '未提供配置ID' });
    }

    const config = await OciConfig.findById(profile_id);
    if (!config) {
      return res.status(400).json({ error: '未找到配置信息' });
    }

    const instanceController = new InstanceController(config);
    await instanceController.changeInstanceIp(instanceId);
    res.json({ message: 'IP更换成功' });
  } catch (error) {
    console.error('更换IP失败:', error);
    res.status(500).json({ error: '更换IP失败' });
  }
});

module.exports = router; 