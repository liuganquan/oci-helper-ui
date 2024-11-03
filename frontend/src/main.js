import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import axios from 'axios'
import dotenv from 'dotenv'

// 直接使用 import.meta.env 获取环境变量
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:20021'

// 设置axios默认配置
axios.defaults.baseURL = apiBaseUrl

// 添加请求拦截器
axios.interceptors.request.use(
    config => {
      const token = localStorage.getItem('token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    },
    error => {
      return Promise.reject(error)
    }
  )
  
  // 添加响应拦截器
  axios.interceptors.response.use(
    response => response,
    error => {
      if (error.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/login')
      }
      return Promise.reject(error)
    }
  )
  

const app = createApp(App)
app.use(ElementPlus)
app.use(router)
app.mount('#app')