import { createRouter, createWebHistory } from 'vue-router'
import Login from './views/Login.vue'
import Home from './views/Home.vue'
import Dashboard from './views/Dashboard.vue'
import GrabManager from './views/GrabManager.vue'

const routes = [
    {
        path: '/login',
        name: 'Login',
        component: Login
      },
    {
        path: '/',
        name: 'Home',
        component: Home
    },
    {
        path: '/dashboard',
        name: 'Dashboard',
        component: Dashboard
    },
    {
        path: '/grab',
        name: 'GrabManager',
        component: GrabManager
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

// 添加全局路由守卫
router.beforeEach((to, from, next) => {
    const token = localStorage.getItem('token')
    if (to.path !== '/login' && !token) {
      next('/login')
    } else if (to.path === '/login' && token) {
      next('/')
    } else {
      next()
    }
  })

export default router 