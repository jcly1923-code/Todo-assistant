# 待办助手（Todo Assistant）

基于 **React（Vite）+ FastAPI** 的待办与工作报告应用：支持多用户、标签、日报/周报、可选 AI 生成与定时任务，以及独立的管理员后台。

**English:** A full-stack todo and work-report app with optional OpenAI-compatible AI, scheduled reports, and an admin area. **License:** MIT. **Contributing:** see [CONTRIBUTING.md](./CONTRIBUTING.md).

**生产环境（Linux 服务器、HTTPS、Nginx）** 的部署步骤见 **[DEPLOY.md](./DEPLOY.md)**。

## 用户视角：能帮你做什么？

- **把「要做什么」和「做得怎么样」放在一处**  
  用待办记录每天的工作项（标题、说明、截止日、地点、标签），再在同一套应用里写**日报 / 周报**，不用在备忘录、文档和邮件之间来回切换。

- **减轻写报告的负担**  
  可选接入 **兼容 OpenAI 的 AI**：根据你已记录的待办，辅助生成或润色报告草稿，减少从零开始凑字的时间。（是否开启、用哪家模型，由你在设置里配置。）

- **让回顾更清晰**  
  用**标签**给任务分类（如项目、类型），按状态区分进行中与已完成；需要交周报时，更容易从真实记录里提炼内容，而不是凭记忆编造。

- **可选自动化**  
  在服务端配置允许的前提下，可按设定时间**定时生成**日报/周报草稿（需后端进程与 AI 可用），适合希望固定节奏产出纪要的用户。

### 为什么能比零散记录更合适？

| 常见痛点 | 本应用中的对应方式 |
|----------|----------------------|
| 记事本里任务散乱，写周报时要翻半天 | 待办结构化 + 标签，和报告在同一应用内，便于对照 |
| 写报告从零开始，费时 | 可选手动撰写，或用 AI 结合待办内容辅助生成 |
| 多设备、多人协作需要账号与隔离 | 支持注册登录；数据按用户隔离；另有管理员后台做运维类管理 |

---

## 功能概览

| 模块 | 说明 |
|------|------|
| **账户** | 邮箱注册/登录、修改密码、基于令牌的重置密码流程 |
| **待办** | 待办标题与描述、状态（进行中/已完成）、截止日期、地点、标签关联 |
| **标签** | 每用户独立标签，颜色区分，与待办多对多关联 |
| **报告** | 日报、周报；支持手动撰写或结合 AI 根据待办数据生成；可查看历史报告 |
| **定时任务** | 按配置的时区与时间自动生成日报/周报（需进程运行且已配置可用的 AI） |
| **设置** | AI 相关配置（兼容 OpenAI API 的网关）、自动化说明等 |
| **管理端** | 独立管理员登录（`/admin/login`），可管理用户等（如 `/admin/users`） |

首次启动且数据库为空时，会按环境变量创建**初始管理员账号**；若存在「无用户但已有历史待办数据」等迁移场景，可按环境变量**引导创建首个普通用户**以认领数据（详见下方环境变量）。

---

## 技术栈

- **前端**：React 19、TypeScript、Vite、Tailwind CSS、Zustand、React Router、Axios  
- **后端**：FastAPI、SQLAlchemy 2（异步）、SQLite（`aiosqlite`）、APScheduler、JWT（用户与管理员分离）  
- **AI 调用**：通过 **OpenAI 兼容 HTTP API**（如官方 OpenAI、本地 Ollama 网关等），在设置或环境变量中配置  

---

## 环境要求

- **Node.js** 18+（建议 LTS）与 **npm**  
- **Python** 3.10+  
- 根目录执行 `npm install` 安装 `concurrently`（用于一键启动前后端）

---

## 快速开始（开发）

1. **克隆仓库**后，在仓库根目录安装根依赖：

   ```bash
   npm install
   ```

2. **后端**：进入 `backend`，创建虚拟环境并安装依赖（示例使用 `venv`）：

   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate   # Windows: 见下方「在 Windows 上运行」
   pip install -r requirements.txt
   ```

3. **前端依赖**：

   ```bash
   cd ../frontend
   npm ci
   ```

4. **一键启动**（在仓库根目录）：

   ```bash
   npm run dev
   ```

   - 前端开发服务器：默认 `http://localhost:5173`（Vite 将 `/api` **代理**到后端）  
   - 后端 API：`http://127.0.0.1:8000`  

   根目录通过 `node scripts/dev-backend.cjs` 调用虚拟环境里的 Python，**在 Windows 与 macOS/Linux 上均可使用**（虚拟环境目录须为 `backend/venv`）。若需改用 `.venv` 等名称，可改该脚本或分两个终端手动启动：

   ```bash
   # 终端 1
   cd frontend && npm run dev
   # 终端 2
   cd backend && source venv/bin/activate && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

5. 浏览器访问 **http://localhost:5173** ，注册或登录后使用主功能；管理端访问 **http://localhost:5173/admin/login**（初始账号见环境变量说明）。

---

## 在 Windows 上运行（从下载到启动）

下面按顺序做即可在本机开发运行（浏览器访问网页，不是打包 exe）。

### Windows 快速参考（概要）

若已熟悉命令行，可按下面顺序快速完成；需要逐步说明或排错时，请继续阅读下方 **「详细步骤」**。

1. **安装软件**：Git（可选）、[Node.js LTS](https://nodejs.org/)（含 npm）、[Python 3.10+](https://www.python.org/downloads/windows/)（安装时勾选将 Python 加入 PATH）。在 PowerShell 中执行 `node -v`、`npm -v`、`python --version` 确认可用。

2. **获取项目**：使用 `git clone <仓库地址>` 后进入 `todo-app` 目录；或下载源码 ZIP，解压到例如 `Documents\todo-app`，在 PowerShell 中用 `cd` 进入该文件夹。

3. **安装依赖**（在**项目根目录**，即包含 `package.json`、`frontend`、`backend` 的那一层，依次执行）：

   ```powershell
   npm install
   cd backend
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   cd ..\frontend
   npm ci
   cd ..
   ```

   - 若 **`Activate.ps1` 无法执行**（脚本策略限制），先运行：`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`，再重新激活虚拟环境。  
   - 若没有 `package-lock.json` 或 `npm ci` 报错，可在 `frontend` 目录改用 `npm install`。

4. **启动**：在项目根目录执行 `npm run dev`（会同时启动 Vite 与 uvicorn）。

5. **在浏览器中打开**：主应用 [http://localhost:5173](http://localhost:5173) ；管理后台 [http://localhost:5173/admin/login](http://localhost:5173/admin/login) ；API 文档 [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) 。

6. **停止服务**：在运行 `npm run dev` 的终端窗口按 **Ctrl+C** 。

7. **与打包 exe 的区别**：上文是 **开发模式**（热更新，本机需安装 Node 与 Python）。若需要 **双击运行且不必安装 Node**，请在 Windows 上按 [Windows 桌面可执行文件](#windows-桌面可执行文件) 自行打包，并运行 `backend\dist\AITodoApp\AITodoApp.exe`（须**整目录**拷贝分发，不要只复制单个 exe）。

---

以下为**分步说明**（与上文「概要」对应，可按需查阅）。

### 1. 安装必备软件

| 软件 | 说明 |
|------|------|
| **Git** | [https://git-scm.com/download/win](https://git-scm.com/download/win) 安装后可在「开始」菜单打开 **Git Bash** 或 **PowerShell** 使用 `git`。 |
| **Node.js LTS** | [https://nodejs.org/](https://nodejs.org/) 安装 18 或更高 LTS，勾选 **npm**。安装后在 PowerShell 执行 `node -v`、`npm -v` 确认。 |
| **Python 3.10+** | [https://www.python.org/downloads/windows/](https://www.python.org/downloads/windows/) 安装时勾选 **Add python.exe to PATH**。在 PowerShell 执行 `python --version`（或 `py -3 --version`）确认。 |

### 2. 获取项目代码

任选其一：

- **Git 克隆**（有仓库地址时）：

  ```powershell
  cd $HOME\Documents
  git clone <你的仓库地址> todo-app
  cd todo-app
  ```

- **下载 ZIP**：在 GitHub/GitLab 等页面下载源码 ZIP，解压到例如 `C:\Users\你的用户名\Documents\todo-app`，之后在 PowerShell 中：

  ```powershell
  cd C:\Users\你的用户名\Documents\todo-app
  ```

### 3. 安装根目录依赖

在项目**根目录**（能看到 `package.json`、`frontend`、`backend` 的那一层）执行：

```powershell
npm install
```

### 4. 创建 Python 虚拟环境并安装后端依赖

```powershell
cd backend
python -m venv venv
```

若系统同时装了多个 Python，可用 `py -3.11 -m venv venv` 等形式指定版本。

**激活虚拟环境并安装依赖**（PowerShell）：

```powershell
.\venv\Scripts\Activate.ps1
```

若提示「无法加载，因为在此系统上禁止运行脚本」，可先以**管理员**打开 PowerShell 执行：

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

然后重新 `cd` 到 `backend` 再执行 `.\venv\Scripts\Activate.ps1`。

安装依赖：

```powershell
pip install -r requirements.txt
cd ..
```

（`cd ..` 回到项目根目录。）

### 5. 安装前端依赖

```powershell
cd frontend
npm ci
```

若没有 `package-lock.json` 或报错，可改用：

```powershell
npm install
cd ..
```

### 6. 启动开发环境

回到**项目根目录**，执行：

```powershell
npm run dev
```

应看到同时启动 **frontend**（Vite）和 **backend**（uvicorn）。首次启动后端会在 `backend\data\` 下创建 SQLite 数据库（若使用默认配置）。

### 7. 用浏览器访问

- **主应用**：[http://localhost:5173](http://localhost:5173) — 注册/登录后使用待办、报告、设置等。  
- **管理后台**：[http://localhost:5173/admin/login](http://localhost:5173/admin/login) — 首次无管理员时，会用环境变量中的默认管理员账号创建（见上文「环境变量」表中的 `ADMIN_BOOTSTRAP_*`）。  
- **API 文档**：[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)  

停止服务：在运行 `npm run dev` 的终端里按 **Ctrl+C**。

### 8. 若一键启动失败（分两个窗口）

- **窗口 A — 前端**（项目根目录）：

  ```powershell
  npm run dev --prefix frontend
  ```

- **窗口 B — 后端**（项目根目录）：

  ```powershell
  cd backend
  .\venv\Scripts\Activate.ps1
  python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
  ```

仍访问 `http://localhost:5173` 即可。

### 9. 与「打包成 exe」的区别

- 上文是 **开发模式**（热更新、需本机安装 Node + Python）。  
- 若只要 **双击运行、不装 Node**，需要在 Windows 上按 [Windows 桌面可执行文件](#windows-桌面可执行文件) 自行打包并运行 `AITodoApp.exe`。

---

## 环境变量（后端）

可在 `backend` 目录下创建 `.env`（勿提交到版本库）；**模板**见 [`backend/.env.example`](./backend/.env.example)。常用项如下。

| 变量 | 说明 |
|------|------|
| `APP_ENV` | 设为 `production` 或 `prod` 时启用生产策略：**必须**设置 `JWT_SECRET`、`ADMIN_JWT_SECRET`；**必须**通过 `ADMIN_BOOTSTRAP_*` 显式指定首个管理员（见下表），否则不会自动创建管理员账号 |
| `DATABASE_URL` | 数据库连接串；默认使用仓库内 `backend/data/todo.db`（SQLite） |
| `JWT_SECRET` | 用户 JWT 签名密钥（生产环境务必修改） |
| `JWT_EXPIRE_DAYS` | 用户 Token 有效天数，默认 `7` |
| `ADMIN_JWT_SECRET` | 管理员 JWT 签名密钥（生产环境务必修改） |
| `ADMIN_JWT_EXPIRE_DAYS` | 管理员 Token 有效天数，默认 `7` |
| `LITELLM_MODEL` | 模型标识，如 `openai/gpt-3.5-turbo` 或仅模型名；与网关约定一致 |
| `LITELLM_API_KEY` | API Key（全局兜底，可与界面内配置配合使用） |
| `LITELLM_BASE_URL` | 可选，自定义 OpenAI 兼容 API 根地址（如本地 Ollama 的 OpenAI 插件地址） |
| `BOOTSTRAP_USER_EMAIL` / `BOOTSTRAP_USER_PASSWORD` | 仅在「迁移认领」场景下用于创建首个普通用户；**生产环境**下两者都必须设置，否则不会自动创建该用户 |
| `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` | 无管理员时自动创建的初始管理员；开发环境有本地默认值；**生产环境**下两者都必须设置，否则不会自动创建管理员 |
| `PUBLIC_APP_URL` | 密码重置链接中的前端根地址，默认 `http://localhost:5173`；**生产环境**请改为 `https://你的域名` |
| `CORS_ORIGINS` | 可选，逗号分隔的额外允许来源（含 `https://`）。同域部署通常不必设置；前后端分离时见 [DEPLOY.md](./DEPLOY.md) |
| `PASSWORD_RESET_TOKEN_HOURS` | 重置密码令牌有效小时数，默认 `1` |
| `FRONTEND_DIST` | 若设为前端构建产物目录（如 `../frontend/dist`），后端将**同时托管静态页面与 API**（用于桌面包或单进程部署） |
| `HOST` / `PORT` | `run_desktop.py` 监听地址与端口，默认 `127.0.0.1` / `8000` |
| `TODO_OPEN_BROWSER` | 设为 `0` 时，`run_desktop.py` 启动后**不**自动打开浏览器 |

---

## Windows 桌面可执行文件

在 **Windows** 上安装 Node、Python 后，可用 PyInstaller 打包含前端静态资源与后端的目录型程序（需在 Windows 本机执行打包）。

1. 安装构建依赖：`pip install -r backend/requirements-build.txt`  
2. 在 PowerShell 中执行仓库内的 **`backend/build_windows.ps1`**（脚本会从仓库根目录构建前端并运行 PyInstaller）。  
3. 产物位于 **`backend/dist/AITodoApp/`**，运行其中的 **`AITodoApp.exe`**；请**整目录**分发，不要只复制单个 exe。  

打包后的数据库默认在 Windows 用户目录下 `%LOCALAPPDATA%\AITodoApp\todo.db`。  

---

## 目录结构（简要）

```
todo-app/
├── frontend/          # Vite + React 前端
├── backend/
│   ├── app/           # FastAPI 应用、路由、模型、服务
│   ├── run_desktop.py # 桌面/打包入口
│   ├── todo-app.spec  # PyInstaller 配置
│   └── build_windows.ps1
├── scripts/
│   └── dev-backend.cjs  # 跨平台启动后端（npm run dev）
├── package.json       # 根目录脚本（npm run dev）
└── README.md
```

---

## API 文档（开发时）

后端以开发模式运行时，可访问：

- Swagger UI：`http://127.0.0.1:8000/docs`  
- OpenAPI JSON：`http://127.0.0.1:8000/openapi.json`  

当前端由后端通过 `FRONTEND_DIST` 托管时，上述文档地址仍然可用。

---

## 开源与许可

- **许可证**：[MIT License](./LICENSE)
- **参与贡献**：见 [CONTRIBUTING.md](./CONTRIBUTING.md)

根目录 `package.json` 中的 `"private": true` 仅表示该包不发布到 npm 公共仓库，与源码许可证无关。

部署到公网前，请务必设置 `APP_ENV=production`、强随机 `JWT_SECRET` / `ADMIN_JWT_SECRET`，以及生产环境下的 `ADMIN_BOOTSTRAP_*` 与 `PUBLIC_APP_URL` 等变量（详见 [DEPLOY.md](./DEPLOY.md)）。
