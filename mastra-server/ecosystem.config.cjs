module.exports = {
  apps: [{
    name: 'videogen-mastra',
    script: '/opt/videogen-mastra/mastra-server/scripts/vps-pm2-start.sh',
    interpreter: 'bash',
    instances: 1,
    autorestart: true,
    max_restarts: 10,
    max_memory_restart: '1G',
    env: { PORT: 4111, NODE_ENV: 'production' },
  }],
};
