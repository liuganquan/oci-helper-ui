module.exports = {
    apps: [{
      name: "backend",
      script: "./backend/src/server.js",
      env: {
        NODE_ENV: "production",
      }
    }, {
      name: "telegram-service",
      script: "./telegram-service/src/server.js",
      env: {
        NODE_ENV: "production",
      }
    }, {
      name: "frontend",
      script: "npm",
      args: "run start:frontend",
      env: {
        NODE_ENV: "production",
      }
    }]
  }