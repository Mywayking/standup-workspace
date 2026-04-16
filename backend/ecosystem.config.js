module.exports = {
  apps: [{
    name: "standup-backend",
    interpreter: "none",
    script: "/bin/bash",
    args: "-c 'cd /root/standup-workspace/backend && uvicorn app.main:app --host 0.0.0.0 --port 8000'",
    cwd: "/root/standup-workspace/backend",
    env: {
      DEEPSEEK_API_KEY: "sk-cc4edf6aa8ad4f3fae8c8a95189e53b9",
    },
  }]
};
