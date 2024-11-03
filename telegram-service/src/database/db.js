const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 获取项目根目录的数据库文件
const dbPath = path.join(__dirname, '../../../database.sqlite');

console.log('数据库路径:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('数据库连接错误:', err);
    } else {
        console.log('数据库连接成功');
    }
});

module.exports = db; 