# CodeMotion

CodeMotion 是面向计算机课程学习者和算法入门者的 AI 代码可视化学习工具。它把 Python 算法代码转换为可播放的执行时间轴、变量变化、调用栈和递归树，并提供围绕当前步骤的导师问答与相似练习建议。

当前版本为 `1.0.0`，交付形态是可运行的移动优先 Web 应用、Node.js API、稳定 mock 数据和可配置的蓝心（Lanxin）真实服务适配框架。

## 已实现功能

- Python 代码输入、重置、长度校验和 AI 分析入口。
- 斐波那契递归、二分查找、括号匹配、深度优先搜索、爬楼梯 DP 五个内置示例。
- 时间轴播放、上一步/下一步、播放速度、代码高亮和变量变化。
- 调用栈与递归树视图，切换视图时保留当前执行步骤。
- AI 导师快捷提问、自定义追问和引用步骤跳转。
- 基于最近一次分析结果的相似练习推荐。
- `mock`、`lanxin`、`fallback` 三种结果来源标识和可恢复错误提示。
- API 请求/响应结构校验；后端不执行用户提交的代码。

## 架构

```text
浏览器 / Capacitor WebView
          |
          | /api（开发代理、反向代理或 VITE_API_BASE_URL）
          v
apps/web: React + TypeScript + Vite
          |
          v
apps/api: Express + TypeScript + Zod
          |
          +--> mock provider（默认、确定性结果）
          |
          +--> Lanxin adapter（服务端凭据、60 秒超时、结构校验）
                         |
                         +--> 失败时返回 fallback 结果
```

Vercel 部署必须保持 Fluid Compute 启用，并确保函数执行时长超过 Lanxin provider 的 60 秒超时，为 fallback 和序列化保留余量。

## 目录

```text
.
├── apps/
│   ├── api/                  # Express API、mock provider、Lanxin adapter
│   └── web/                  # React 移动优先 Web 应用
├── docs/
│   ├── deployment.md         # 本地、生产和 Capacitor 8 APK 教程
│   ├── demo-script.md        # 3 分钟与 8 分钟演示脚本
│   ├── test-report.md        # 本地验证结果与待执行验收项
│   └── superpowers/          # 已批准设计与实施计划
├── package.json              # pnpm workspace 根脚本
├── pnpm-lock.yaml
└── pnpm-workspace.yaml
```

## 快速启动

要求：Node.js `>=20`、pnpm `11`。以下命令均在仓库根目录执行。

```powershell
pnpm install --frozen-lockfile
pnpm dev:api
```

另开一个 PowerShell 窗口，在仓库根目录执行：

```powershell
pnpm dev:web
```

访问：

- Web：<http://localhost:5173>
- API 健康检查：<http://localhost:3000/api/health>

本地开发服务器把 `/api` 代理到 `http://localhost:3000`。默认 `LLM_MODE=mock`，无需真实凭据即可完成核心演示。

## Mock 与真实蓝心模式

- `mock`：默认模式，返回稳定、可重复的演示数据，适合开发、验收和离线演示。
- `real`：API 服务使用 `LANXIN_API_URL`、`LANXIN_APP_ID`、`LANXIN_APP_KEY` 请求通用 Lanxin gateway。
- `fallback`：配置为 `real` 但上游不可用、超时或返回结构不合格时，API 明确降级为 mock 结果，不静默伪装成真实调用。

真实配置只放在 `apps/api/.env` 或部署平台的服务端 Secret 中。切换方法、请求契约和 `source` 验证步骤见[部署指南](docs/deployment.md)。

## 安全边界

- 不要把 `LANXIN_APP_KEY`、Authorization 值或其他真实凭据写入 Web 源码、`VITE_*` 变量、构建产物、APK、截图、日志或文档。
- `VITE_API_BASE_URL` 只能保存公开的 HTTPS API 地址，它会被编译进 Web/APK。
- API 只分析文本，不执行用户代码；本项目不是在线判题或通用沙箱。
- `.env` 已被 Git 忽略；`.env.example` 只能使用占位值。
- 发布前按[部署指南的敏感信息扫描](docs/deployment.md#10-敏感信息扫描)执行源码、Web 构建和 APK 解包检查。

## 文档

- [部署与 Capacitor 8 APK 教程](docs/deployment.md)
- [3 分钟与 8 分钟演示脚本](docs/demo-script.md)
- [测试报告与证据计划](docs/test-report.md)
- [已批准的 Option A 设计](docs/superpowers/specs/2026-06-26-codemotion-option-a-design.md)
- [Option A 实施计划](docs/superpowers/plans/2026-06-26-codemotion-option-a-implementation.md)

## 当前交付边界

本阶段交付 Web + API + mock/real 蓝心接入框架，以及部署、测试和完整 APK 打包教程。**当前仓库不包含、也不承诺已经生成 `CodeMotion-1.0.0.apk`**；APK 构建、签名、真机安装与验收均留待后续执行。当前也未提供生产 Web/API 地址，真实 Lanxin 链路尚未使用真实凭据验证。准确状态见[测试报告](docs/test-report.md)。
