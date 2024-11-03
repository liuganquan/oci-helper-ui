const db = require('../database/db');

class GlobalConfig {
    static async get() {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM global_configs ORDER BY id DESC LIMIT 1', (err, row) => {
                if (err) reject(err);
                else resolve({
                    auto_grab_enabled: row ? Boolean(row.auto_grab_enabled) : false
                });
            });
        });
    }

    static async update(config) {
        return new Promise((resolve, reject) => {
            const auto_grab_enabled = config.auto_grab_enabled ? 1 : 0;
            
            db.run(`
                INSERT OR REPLACE INTO global_configs (
                    auto_grab_enabled, updated_at
                ) VALUES (?, CURRENT_TIMESTAMP)
            `, [auto_grab_enabled], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

module.exports = GlobalConfig; 