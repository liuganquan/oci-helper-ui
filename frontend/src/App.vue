<script setup>
import { Setting, Monitor, Timer } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { jwtDecode } from 'jwt-decode'

const route = useRoute()
const router = useRouter()
const showMenu = computed(() => route.path !== '/login')

const handleLogout = () => {
  localStorage.removeItem('token')
  router.push('/login')
}

const username = computed(() => {
  const token = localStorage.getItem('token')
  if (token) {
    try {
      const decoded = jwtDecode(token)
      return decoded.username
    } catch (error) {
      return ''
    }
  }
  return ''
})
</script>

<template>
  <!-- 登录页面不显示侧边栏和头部 -->
  <el-container v-if="!showMenu">
    <el-main>
      <router-view></router-view>
    </el-main>
  </el-container>

  <!-- 其他页面显示完整布局 -->
  <el-container v-else class="layout-container">
    <el-aside width="200px">
      <el-menu
        router
        :default-active="$route.path"
        class="el-menu-vertical"
      >
        <el-menu-item index="/">
          <el-icon><Setting /></el-icon>
          <span>配置管理</span>
        </el-menu-item>
        <el-menu-item index="/dashboard">
          <el-icon><Monitor /></el-icon>
          <span>实例管理</span>
        </el-menu-item>
        <el-menu-item index="/grab">
          <el-icon><Timer /></el-icon>
          <span>抢机管理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    
    <el-container>
      <el-header>
        <div class="header-content">
          <h2>OCI实例管理系统</h2>
          <div class="user-info">
            <span>{{ username }}</span>
            <el-button type="text" @click="handleLogout">退出登录</el-button>
          </div>
        </div>
      </el-header>
      <el-main>
        <router-view></router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout-container {
  height: 100vh;
}

.el-header {
  background-color: #409EFF;
  color: white;
  line-height: 60px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.el-aside {
  background-color: #545c64;
}

.el-menu {
  border-right: none;
}

.el-menu-vertical {
  height: 100%;
}

:deep(.el-button--text) {
  color: white;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-info span {
  color: white;
}
</style>
