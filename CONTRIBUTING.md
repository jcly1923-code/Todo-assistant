# 参与贡献

感谢你愿意改进本项目。建议流程如下。

## 开发环境

1. 克隆仓库后，在根目录执行 `npm install`。
2. 后端：`cd backend && python3 -m venv venv && source venv/bin/activate`（Windows 使用 `venv\Scripts\activate`），然后 `pip install -r requirements.txt`。
3. 前端：`cd frontend && npm ci`（若无 lock 文件可用 `npm install`）。
4. 在仓库根目录执行 `npm run dev`，浏览器访问 `http://localhost:5173`。

将 `backend/.env.example` 复制为 `backend/.env` 并按需填写；**不要**把 `.env` 提交到 Git。

## 提交代码前

- 尽量保持改动与议题或 PR 描述一致，避免无关重构。
- 前端可运行 `npm run lint --prefix frontend`；后端若有测试请确保通过。
- 不要提交密钥、真实邮箱、内网地址或大型二进制私货。

## Pull Request

1. 从最新 `main`（或默认分支）新建分支。
2. 写清楚变更动机与行为变化；若涉及配置或部署，请同步更新 `README.md` 或 `DEPLOY.md`。
3. 发起 PR 后耐心等待评审；小步修改更容易合并。

## 行为准则

在 Issue、PR 与讨论中保持尊重与建设性，对事不对人。
