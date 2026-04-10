# 待办助手 · 前端（Vite + React）

本目录是「待办助手」的 Web 界面。**完整项目说明（含后端、部署、环境变量）见仓库根目录 [README.md](../README.md)。**

---

## 这个工具能帮你做什么？

- **把「要做什么」和「做得怎么样」放在一处**  
  用待办记录每天的工作项（标题、说明、截止日、地点、标签），再在同一套应用里写**日报 / 周报**，不用在备忘录、文档和邮件之间来回切换。

- **减轻写报告的负担**  
  可选接入 **兼容 OpenAI 的 AI**：根据你已记录的待办，辅助生成或润色报告草稿，减少从零开始凑字的时间。（是否开启、用哪家模型，由你在设置里配置。）

- **让回顾更清晰**  
  用**标签**给任务分类（如项目、类型），按状态区分进行中与已完成；需要交周报时，更容易从真实记录里提炼内容，而不是凭记忆编造。

- **可选自动化**  
  在服务端配置允许的前提下，可按设定时间**定时生成**日报/周报草稿（需后端进程与 AI 可用），适合希望固定节奏产出纪要的用户。

| 常见痛点                           | 待办助手里的对应方式                                     |
| ---------------------------------- | -------------------------------------------------------- |
| 记事本里任务散乱，写周报时要翻半天 | 待办结构化 + 标签，和报告在同一应用内，便于对照          |
| 写报告从零开始，费时               | 可选手动撰写，或用 AI 结合待办内容辅助生成               |
| 多设备、多人协作需要账号与隔离     | 支持注册登录；数据按用户隔离；另有管理员后台做运维类管理 |

### 界面里大致有什么？

- **账户**：注册、登录、改密码、忘记密码流程（具体以后端配置为准）。
- **待办与标签**：列表、筛选、截止日期与标签关联。
- **报告**：新建/编辑日报或周报、查看历史。
- **设置**：例如 AI 网关地址与密钥（若使用 AI 功能）。
- **管理端**（独立入口）：管理员登录后的用户等管理页面（路径见根目录 README）。

---

## 本地运行与构建（本目录）

```bash
cd frontend
npm ci
npm run dev
```

默认开发地址一般为 `http://localhost:5173`。仅启动前端时，若没有后端，登录与数据接口会不可用；**推荐在仓库根目录执行 `npm run dev` 同时启动前后端**，步骤见 [README.md](../README.md)。

生产构建：`npm run build`，产物在 `frontend/dist`；与后端的部署关系见根目录 **DEPLOY.md**。

---

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

### React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

### Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

---

**English:** Todo Assistant frontend — todos, tags, and daily/weekly reports in the browser, with optional AI-assisted drafting when the backend is configured. See the [root README](../README.md) for the full stack.
