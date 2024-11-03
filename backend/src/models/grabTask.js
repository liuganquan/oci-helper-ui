const db = require('../database/db');

// 创建抢机任务表
const createGrabTaskTable = `
CREATE TABLE IF NOT EXISTS grab_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    shape TEXT NOT NULL,
    availability_domain TEXT NOT NULL,
    image_id TEXT NOT NULL,
    auth_type TEXT NOT NULL,
    ssh_key TEXT,
    wait_time INTEGER DEFAULT 30,
    boot_volume_size INTEGER,
    ocpus INTEGER,
    memory_in_gbs INTEGER,
    subnet_id TEXT,
    status TEXT DEFAULT 'pending',
    instance_id TEXT,
    instance_ip TEXT,
    instance_password TEXT,
    target_count INTEGER DEFAULT 1,
    current_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(profile_id) REFERENCES oci_configs(id)
)`;

// 创建任务日志表
const createGrabTaskLogTable = `
CREATE TABLE IF NOT EXISTS grab_task_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES grab_tasks (id)
)`;

// 创建全局配置表
const createGlobalConfigTable = `
CREATE TABLE IF NOT EXISTS global_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    auto_grab_enabled BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`;

// 初始化表
function initTables() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(createGrabTaskTable)
              .run(createGrabTaskLogTable)
              .run(createGlobalConfigTable, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });
}

// 抢机任务模型
class GrabTask {
    // 创建任务
    static async create(task) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO grab_tasks (
                    profile_id, shape, availability_domain, image_id, 
                    auth_type, ssh_key, wait_time, boot_volume_size,
                    ocpus, memory_in_gbs, subnet_id, status,
                    target_count, current_count
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            db.run(sql, [
                task.profile_id,
                task.shape,
                task.availability_domain,
                task.image_id,
                task.auth_type,
                task.ssh_key,
                task.wait_time,
                task.boot_volume_size,
                task.ocpus,
                task.memory_in_gbs,
                task.subnet_id,
                task.status,
                task.target_count || 1,
                0
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    // 获取所有任务
    static async findAll() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    t.*,
                    c.profile_name,
                    c.region
                FROM grab_tasks t
                LEFT JOIN oci_configs c ON t.profile_id = c.id
                ORDER BY t.created_at DESC
            `;
            db.all(sql, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // 获取单个任务
    static async findById(id) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM grab_tasks WHERE id = ?';
            db.get(sql, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    // 更新任务状态
    static async updateStatus(id, status) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE grab_tasks 
                SET status = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            db.run(sql, [status, id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    // 删除任务
    static async delete(id) {
        return new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION');
            db.run('DELETE FROM grab_task_logs WHERE task_id = ?', [id], (err) => {
                if (err) {
                    db.run('ROLLBACK');
                    reject(err);
                    return;
                }
                db.run('DELETE FROM grab_tasks WHERE id = ?', [id], (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        reject(err);
                        return;
                    }
                    db.run('COMMIT');
                    resolve();
                });
            });
        });
    }

    // 添加任务日志
    static async addLog(taskId, level, message) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO grab_task_logs (task_id, level, message)
                VALUES (?, ?, ?)
            `;
            db.run(sql, [taskId, level, message], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    // 获取任务日志
    static async getLogs(taskId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    id,
                    task_id,
                    level,
                    message,
                    datetime(created_at, 'localtime') as created_at
                FROM grab_task_logs 
                WHERE task_id = ? 
                ORDER BY created_at DESC
            `;
            db.all(sql, [taskId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    // 获取最后一条日志
    static async getLastLog(taskId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    id,
                    task_id,
                    level,
                    message,
                    datetime(created_at, 'localtime') as created_at
                FROM grab_task_logs 
                WHERE task_id = ? 
                ORDER BY created_at DESC
                LIMIT 1
            `;
            db.get(sql, [taskId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    static async incrementCount(taskId) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE grab_tasks 
                SET current_count = current_count + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            db.run(sql, [taskId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    // 更新密码
    static async updatePassword(taskId, password) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE grab_tasks 
                SET instance_password = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            db.run(sql, [password, taskId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
    // 根据状态查找任务
    static async findByStatus(status) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM grab_tasks WHERE status = ?';
            db.all(sql, [status], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }
    // 更新实例信息
    static async updateInstanceInfo(taskId, instanceId, instanceIp) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE grab_tasks 
                SET instance_id = ?,
                    instance_ip = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            db.run(sql, [instanceId, instanceIp, taskId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    // 添加新的实例信息
    static async addInstanceInfo(taskId, instanceId, instanceIp, instancePassword) {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                // 先获取当前实例信息
                db.get(
                    'SELECT instance_id, instance_ip, instance_password FROM grab_tasks WHERE id = ?',
                    [taskId],
                    (err, row) => {
                        if (err) {
                            console.error('获取实例信息失败:', err);
                            db.run('ROLLBACK');
                            reject(err);
                            return;
                        }

                        // 合并实例信息，用分号分隔
                        const newInstanceId = row.instance_id ? `${row.instance_id};${instanceId}` : instanceId;
                        const newInstanceIp = row.instance_ip ? `${row.instance_ip};${instanceIp}` : instanceIp;
                        const newInstancePassword = instancePassword ? 
                            (row.instance_password ? `${row.instance_password};${instancePassword}` : instancePassword) 
                            : row.instance_password;

                        console.log('准备更新实例信息:', {
                            taskId,
                            newInstanceId,
                            newInstanceIp,
                            newInstancePassword
                        });

                        // 更新数据库
                        db.run(
                            `UPDATE grab_tasks 
                            SET instance_id = ?,
                                instance_ip = ?,
                                instance_password = ?,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?`,
                            [newInstanceId, newInstanceIp, newInstancePassword, taskId],
                            (updateErr) => {
                                if (updateErr) {
                                    console.error('更新实例信息失败:', updateErr);
                                    db.run('ROLLBACK');
                                    reject(updateErr);
                                    return;
                                }
                                db.run('COMMIT');
                                console.log('实例信息更新成功');
                                resolve();
                            }
                        );
                    }
                );
            });
        });
    }
}

// 初始化表
initTables().catch(console.error);

module.exports = GrabTask;