module.exports = {
  apps: [{
    name: 'standup-frontend',
    cwd: '/root/standup-workspace/frontend',
    script: 'node_modules/.bin/next',
    args: 'start -p 3117',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: '3117'
    }
  }]
};
