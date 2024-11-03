const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') }); // 加载根目录env
require('dotenv').config({ path: path.join(__dirname, '../../.env') }); // 加载当前模块env
