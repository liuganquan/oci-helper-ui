const db = require('../database/db');

class OciConfig {
    static async create(config) {
        return new Promise((resolve, reject) => {
            const { profile_name, user_ocid, tenancy_ocid, region, fingerprint, private_key } = config;
            db.run(
                `INSERT INTO oci_configs (profile_name, user_ocid, tenancy_ocid, region, fingerprint, private_key) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [profile_name, user_ocid, tenancy_ocid, region, fingerprint, private_key],
                function(err) {
                    if (err) reject(err);
                    resolve(this.lastID);
                }
            );
        });
    }

    static async findAll() {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM oci_configs', (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });
    }

    static async findById(id) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM oci_configs WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
    }

    static async delete(id) {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM oci_configs WHERE id = ?', [id], (err) => {
                if (err) reject(err);
                resolve();
            });
        });
    }
}

module.exports = OciConfig;