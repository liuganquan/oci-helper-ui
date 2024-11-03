import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig(({ mode }) => {
  
  return {
    plugins: [vue()],
    envDir: path.resolve(__dirname, '../'), // 指定环境变量文件的目录为项目根目录
    server: {
      host: '0.0.0.0',
      port: process.env.VITE_PORT || 20022,
      proxy: {
        '/api': {
          target: process.env.VITE_API_BASE_URL || 'http://localhost:20021',
          changeOrigin: true
        }
      }
    }
  }
})
