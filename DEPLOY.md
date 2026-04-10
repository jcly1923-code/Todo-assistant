# 服务器部署教程

本文说明如何在 **Linux 服务器**（以常见发行版 **Ubuntu 22.04 LTS** 为例）上部署本项目的**生产环境**：同一域名下提供前端页面与 `/api` 接口，使用 **Nginx** 反向代理、**HTTPS**，由 **systemd** 常驻运行 **Uvicorn**。

> **适用场景**：团队或小范围用户通过浏览器访问（`https://你的域名`），数据落在服务器本地 SQLite（默认）或你自行替换的数据库。  
> **SQLite 注意**：请使用 **单进程** Uvicorn（不要多 worker），避免并发写入问题。若需多实例横向扩展，应改用 PostgreSQL 等并调整 `DATABASE_URL`（需自行改代码与迁移，本文不展开）。

---

## 一、架构说明

推荐 **同域部署**（用户只访问一个域名，无跨域问题）：

```
用户浏览器 → HTTPS → Nginx (443)
              ├─ 静态资源 / 、/assets/*  → 可选：由 Nginx 直接提供 frontend/dist
              └─ /api/* 、/docs 等      → 反代到 127.0.0.1:8000（Uvicorn）
```

更简单的做法是：**不**让 Nginx 托管静态文件，只把 **所有 HTTP** 反代到 Uvicorn，由 FastAPI 通过环境变量 **`FRONTEND_DIST`** 同时托管前端构建产物与 API（与桌面包一致）。下文按此「**单后端进程托管前后端**」方式编写，运维步骤最少。

---

## 二、服务器准备

1. 一台可 SSH 登录的 Linux 云主机（公网 IP 或已绑定域名）。  
2. 系统示例：**Ubuntu 22.04**。  
3. 开放防火墙端口：**80**（证书申请）、**443**（HTTPS）；**22**（SSH）。  
4. 将域名 **A 记录** 指向该服务器公网 IP（使用 HTTPS 时必需）。

安装基础依赖：

```bash
sudo apt update && sudo apt install -y git nginx python3-venv python3-pip certbot python3-certbot-nginx curl
```

安装 **Node.js 18+**（仅构建前端时需要，构建完成后可不装在生产机长期运行；若希望构建在 CI/本机完成，可跳过在服务器安装 Node，改为上传 `frontend/dist`）：

```bash
# 示例：使用 NodeSource（以 20.x 为例，请按官网更新）
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v
```

---

## 三、获取代码与构建

```bash
sudo mkdir -p /opt/todo-app
sudo chown "$USER":"$USER" /opt/todo-app
cd /opt/todo-app
git clone <你的仓库地址> .
```

### 1. Python 虚拟环境与后端依赖

```bash
cd /opt/todo-app/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 2. 构建前端

```bash
cd /opt/todo-app/frontend
npm ci
npm run build
```

确认存在目录 **`/opt/todo-app/frontend/dist`**。

---

## 四、环境变量（生产必须修改）

在 **`/opt/todo-app/backend`** 下创建 **`.env`**（权限建议 `chmod 600 .env`），**不要**提交到 Git。

示例（请替换为你的真实值）：

```env
# 启用生产环境策略（强校验 JWT 与引导账号；务必设置）
APP_ENV=production

# 数据库（默认 SQLite，路径需可写）
DATABASE_URL=sqlite+aiosqlite:////opt/todo-app/backend/data/todo.db

# 对外访问的前端根 URL（密码重置链接、日志等会用到）
PUBLIC_APP_URL=https://你的域名

# JWT（务必改为随机长字符串）
JWT_SECRET=请替换为随机字符串
ADMIN_JWT_SECRET=请替换为另一段随机字符串

# 可选：若前端与 API 不同源，再配置（逗号分隔，无空格）
# CORS_ORIGINS=https://app.example.com

# OpenAI 兼容 API（按需）
# LITELLM_API_KEY=
# LITELLM_BASE_URL=
# LITELLM_MODEL=openai/gpt-3.5-turbo

# 首次无管理员时创建（APP_ENV=production 时必填，否则不会自动创建）
ADMIN_BOOTSTRAP_EMAIL=admin@yourcompany.com
ADMIN_BOOTSTRAP_PASSWORD=强密码
```

确保数据目录存在：

```bash
mkdir -p /opt/todo-app/backend/data
```

`DATABASE_URL` 使用 **四个斜杠** `////` 接绝对路径，是 SQLAlchemy 在 Linux 上表示「根目录下绝对路径」的常见写法；也可使用相对路径 `./data/todo.db`（相对进程工作目录）。

**加载 `.env`**：本项目使用 `python-dotenv`，默认会从**当前工作目录**查找 `.env`。systemd 里会把 `WorkingDirectory` 设为 `backend`，因此把 `.env` 放在 `backend/.env` 即可。

---

## 五、手动验证（可选）

```bash
cd /opt/todo-app/backend
source venv/bin/activate
export FRONTEND_DIST=/opt/todo-app/frontend/dist
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

本机可 `curl -I http://127.0.0.1:8000/` 应返回 200；浏览器通过服务器 IP 临时访问需放行 8000 端口，**生产环境请仅通过 Nginx 443 访问**。

---

## 六、systemd 服务

创建 **`/etc/systemd/system/todo-app.service`**：

```ini
[Unit]
Description=待办助手 FastAPI (Uvicorn)
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/todo-app/backend
Environment=FRONTEND_DIST=/opt/todo-app/frontend/dist
EnvironmentFile=-/opt/todo-app/backend/.env
ExecStart=/opt/todo-app/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

说明：

- **`User=www-data`**：与 Nginx 常见用户一致，需保证对 `backend/data`、`frontend/dist` 有读权限。若权限报错，可将代码目录所有者改为 `www-data`，或把 `User` 改为你部署用户并相应配置 Nginx。  
- **`EnvironmentFile`**：加载 `.env`；若系统不支持 `-` 前缀语法，可改为 `EnvironmentFile=/opt/todo-app/backend/.env` 并保证文件存在。  
- **单 worker**：不要使用 `--workers 2`，以免 SQLite 锁问题。

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now todo-app
sudo systemctl status todo-app
```

---

## 七、Nginx 反向代理与 HTTPS

### 1. HTTP 站点（仅反代）

创建 **`/etc/nginx/sites-available/todo-app`**：

```nginx
server {
    listen 80;
    server_name 你的域名;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用站点并重载：

```bash
sudo ln -sf /etc/nginx/sites-available/todo-app /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 2. 申请 Let’s Encrypt 证书

```bash
sudo certbot --nginx -d 你的域名
```

按提示完成 HTTPS。Certbot 会修改 Nginx 配置；之后证书自动续期由 certbot 定时任务处理。

### 3. 可选：加大上传体积等

若将来有上传接口，可在 `server` 中增加 `client_max_body_size 20m;`。

---

## 八、部署与更新流程小结

1. `git pull`  
2. `cd frontend && npm ci && npm run build`  
3. `cd ../backend && source venv/bin/activate && pip install -r requirements.txt`  
4. `sudo systemctl restart todo-app`  

数据库文件在 `backend/data/` 下时请**先备份再更新**。

---

## 九、备份与安全建议

- **定期备份** `todo.db`（或整目录 `backend/data/`）。  
- **轮换** `JWT_SECRET` / `ADMIN_JWT_SECRET` 会使已有 token 失效，需在维护窗口操作。  
- 仅开放 **80/443**，SSH 建议用密钥并禁用密码登录。  
- 设置 **`APP_ENV=production`**，并配置强随机 `JWT_SECRET` / `ADMIN_JWT_SECRET`；首次部署时按需设置 `ADMIN_BOOTSTRAP_*`，登录后尽快修改管理员密码。

---

## 十、常见问题

| 现象 | 可能原因 |
|------|----------|
| 502 Bad Gateway | `todo-app` 未启动或监听非 8000；`proxy_pass` 地址错误。 |
| 页面空白、静态 404 | `FRONTEND_DIST` 未设置或路径错误；`frontend/dist` 未构建。 |
| 登录后接口 401 / CORS | 同域部署一般无 CORS；若前后端分离，设置 `CORS_ORIGINS` 为前端完整 origin（含 `https://`）。 |
| SQLite database is locked | 多进程/多 worker 同时写 SQLite；改为单 worker 或换数据库。 |

---

## 十一、与「Windows 桌面包」对比

| 方式 | 适用对象 |
|------|----------|
| **服务器部署（本文）** | 多人通过浏览器访问同一套数据，集中运维。 |
| **README 中的 Windows exe** | 单机离线或每人一份本地数据。 |

两者可同时存在：服务器给团队用，exe 给不需要服务器的个人用户。
