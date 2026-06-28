# CodeMotion 测试报告

## 1. 基本信息

| 项目 | 当前值 |
| --- | --- |
| 产品版本 | `1.0.0` |
| 报告日期 | `2026-06-28` |
| 测试执行者 | Task 8 统一验收执行者（待定） |
| 仓库 | `C:\Users\lqh22\Documents\vivoAigc` |
| 本地 Web | `http://localhost:5173`（待 Task 8 启动验证） |
| 本地 API | `http://localhost:3000`（待 Task 8 启动验证） |
| 生产 Web/API | 未部署、未提供 URL |
| APK | **无 artifact；PENDING / NOT EXECUTED** |
| Mock 模式 | 已有实现与自动化测试文件，待 Task 8 统一执行并保存证据 |
| Real Lanxin | **未使用真实凭据验证** |
| 证据目录 | `evidence/` 当前不存在；下表路径均为待生成目标，不代表已有证据 |

## 2. 状态口径

- `PASS`：按规格完成步骤，满足全部通过标准，且证据文件实际存在并可复核。
- `FAIL`：已执行但至少一个通过标准不满足，必须记录缺陷与证据。
- `PENDING`：尚未由 Task 8 按统一环境执行，不能据代码存在或测试文件存在推断 PASS。
- `PENDING / NOT EXECUTED`：明确没有执行条件或 artifact；本报告的 APK 项使用此状态。

当前报告是 Task 7 的验收骨架，**所有 16 个 AC 均保持 PENDING**。已有自动化覆盖说明只表示仓库中存在相关测试，不表示本报告已运行或通过。

## 3. 发布门槛与 P0/P1 规则

- P0：交付阻断项。所有 P0 必须 PASS 且证据完整；任一 FAIL 或 PENDING 都不能宣布最终可交付。
- P1：完整比赛体验要求。P0 全部 PASS 后，P1 应全部 PASS；例外必须有责任人、风险接受和修复计划。
- P2：增强质量项。不阻断当前功能演示，但结果必须如实记录。
- Blocker：APK/Web/API/主流程不可用或发生密钥泄露，立即停止发布。
- Critical：核心 AI 结果不可渲染且无降级、播放不可用、核心可视化数据错误或移动布局严重破坏。

当前汇总：

| 优先级 | PASS | FAIL | PENDING | 总数 | 判定 |
| --- | ---: | ---: | ---: | ---: | --- |
| P0 | 0 | 0 | 10 | 10 | 未达到发布门槛 |
| P1 | 0 | 0 | 5 | 5 | 未执行 |
| P2 | 0 | 0 | 1 | 1 | 未执行 |

## 4. 16 个验收项

| ID | 优先级 | 验收点 | 状态 | 已有自动化覆盖（未执行） | Task 8 目标证据 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| AC-DEL-001 | P0 | APK 可安装并启动 | **PENDING / NOT EXECUTED** | 无 | `evidence/apk/CodeMotion-1.0.0.apk`；`evidence/apk/sha256.txt`；`evidence/screenshots/apk-install.png`；`evidence/screenshots/apk-home.png` | 当前没有 APK artifact，不得标 PASS。 |
| AC-DEL-002 | P0 | Web 体验链接可访问 | PENDING | 初始工作台组件测试仅覆盖渲染逻辑 | `evidence/web/url.txt`；`evidence/screenshots/web-home-360.png`；`evidence/logs/browser-console.txt` | 当前无生产 URL。 |
| AC-DEL-003 | P0 | 部署教程可复现 | PENDING | 无端到端空环境复现测试 | `evidence/logs/deployment-reproduction.txt`；`evidence/api/health.json`；`evidence/screenshots/example-analysis.png` | 必须由干净环境按 `docs/deployment.md` 执行。 |
| AC-SEC-001 | P0 | 前端和 APK 不泄露 AppKEY | PENDING | 前端错误隐藏上游细节；不等于 secret scan | `evidence/security/secret-scan.txt`；`evidence/security/web-dist-secret-scan.txt`；`evidence/security/apk-secret-scan.txt` | APK 不存在，APK 扫描未执行。 |
| AC-API-001 | P0 | `/api/health` 可用 | PENDING | API health 与 CORS 测试文件已覆盖 | `evidence/api/health.json`；`evidence/logs/api-startup.txt` | 待 Task 8 运行并保存原始输出。 |
| AC-AI-001 | P0 | 蓝心链路或明确 mock 降级 | PENDING | mock、Lanxin 响应解析、结构校验和 fallback 测试文件已覆盖 | `evidence/api/analyze-fibonacci.json`；`evidence/logs/lanxin-redacted.txt`；`evidence/screenshots/fallback-warning.png` | real Lanxin 未用真实凭据验证。 |
| AC-CORE-001 | P0 | 输入/选择代码并发起分析 | PENDING | Web 输入校验、示例载入和分析状态测试文件已覆盖 | `evidence/screenshots/workbench-input.png`；`evidence/screenshots/analyzing.png`；`evidence/screenshots/analysis-result.png` | 待浏览器手工/端到端验证。 |
| AC-CORE-002 | P0 | 分析结果播放 trace | PENDING | playback 边界、步进、视图状态和自动停止测试文件已覆盖 | `evidence/videos/trace-playback.mp4`；`evidence/screenshots/trace-first.png`；`evidence/screenshots/trace-middle.png`；`evidence/screenshots/trace-last.png` | 待真实浏览器录制。 |
| AC-CORE-003 | P0 | 递归示例展示递归树 | PENDING | Fibonacci mock schema、引用完整性和递归树交互测试文件已覆盖 | `evidence/screenshots/fibonacci-tree.png`；`evidence/videos/recursion-node-jump.mp4` | 待确认 `fib(4)`、子调用、返回值和节点跳转。 |
| AC-CORE-004 | P0 | 二分示例展示变量变化 | PENDING | mock 边界收缩测试文件已覆盖 | `evidence/api/analyze-binary-search.json`；`evidence/screenshots/binary-variables.png` | 待确认 `left/right/mid` 与返回索引 3。 |
| AC-TUTOR-001 | P1 | 围绕当前代码追问 | PENDING | mock 导师上下文、referenced steps 和前端交互测试文件已覆盖 | `evidence/api/tutor-chat.json`；`evidence/screenshots/tutor-current-step.png` | real 导师未使用真实凭据验证。 |
| AC-PRACTICE-001 | P1 | 推荐相似练习 | PENDING | 推荐展示与返回工作台测试文件已覆盖 | `evidence/screenshots/practice-recommendations.png` | 待确认至少 3 条及字段完整。 |
| AC-UI-001 | P1 | 移动端 360px 无布局破坏 | PENDING | 组件测试不等于真实视口视觉验收 | `evidence/screenshots/360-workbench.png`；`evidence/screenshots/390-examples.png`；`evidence/screenshots/430-visualizer.png` | 需覆盖 360x800、390x844、430x932。 |
| AC-ERR-001 | P1 | 接口失败有可恢复提示 | PENDING | 离线、分析失败、重试与敏感错误隐藏测试文件已覆盖 | `evidence/screenshots/recoverable-error.png`；`evidence/logs/api-error-redacted.txt` | 待模拟 API 关闭或 500。 |
| AC-PERF-001 | P1 | 首屏和播放响应达标 | PENDING | 无符合规格的计时证据 | `evidence/performance/lighthouse.json`；`evidence/performance/manual-timing.md`；`evidence/logs/api-duration.txt` | APK 启动和 real 45 秒超时未执行。 |
| AC-A11Y-001 | P2 | 基础按钮和颜色可访问 | PENDING | 部分 aria-label、status 和键盘相关组件测试文件已覆盖 | `evidence/accessibility/axe-results.json`；`evidence/screenshots/keyboard-focus.png`；`evidence/screenshots/contrast-check.png` | 需工具扫描加人工键盘验证。 |

## 5. AI Harness 数据集

依据 `spec/04-acceptance-criteria-and-test-evidence.md`，Task 8 使用固定数据集，保持输入和评分规则不变。

| Dataset | 目的 | 关键断言 | 分数 | 状态 | 目标证据 |
| --- | --- | --- | ---: | --- | --- |
| A：Fibonacci 递归 | 递归、调用栈、递归树 | 结果为 3；关键 trace 合理；存在 `recursionTree` | - | PENDING | `evidence/api/analyze-fibonacci.json`；`evidence/harness/fibonacci-score.md` |
| B：二分查找 | 循环、条件、区间收缩 | 包含 `left/right/mid`；返回索引 3 | - | PENDING | `evidence/api/analyze-binary-search.json`；`evidence/harness/binary-search-score.md` |
| C：括号匹配 | 栈 push/pop 和失败条件 | 输出 `True`；栈变化与代码一致 | - | PENDING | `evidence/api/analyze-bracket-match.json`；`evidence/harness/bracket-match-score.md` |
| D：错误输入 | 语法错误恢复 | 不崩溃；友好错误或无法分析提示；有示例入口 | - | PENDING | `evidence/api/analyze-broken-code.json`；`evidence/screenshots/broken-code-recovery.png` |

### 评分规则

- JSON 格式合法 15 分。
- 功能总结 10 分。
- 逐行解释 15 分。
- trace 步骤 20 分。
- 变量变化 10 分。
- 调用栈/递归树 15 分。
- 复杂度说明 5 分。
- 练习推荐 5 分。
- 用户友好性 5 分。

单个 Dataset 必须 `>=80` 分；“JSON 格式合法”和“trace 步骤”不得为 0。递归数据必须有 `recursionTree`，二分数据必须包含 `left`、`right`、`mid`。本报告尚未评分，不能用 mock fixture 的存在替代 Harness 结果。

## 6. Task 8 建议执行顺序

1. 记录 Node/pnpm/OS/浏览器版本，执行 `pnpm install --frozen-lockfile`。
2. 执行 `pnpm test` 和 `pnpm build`，保存完整控制台输出与退出码。
3. 在 mock 模式启动 Web/API，采集 health、五个示例和四个 Harness 数据集响应。
4. 逐项执行 P0 Web/API/核心流程，随后执行 P1/P2。
5. 在 360x800、390x844、430x932 视口做视觉验收和截图。
6. 模拟 API 失败与 real fallback，确认提示、warning 和 `source`。
7. 如获得授权的真实 Lanxin 测试凭据，在隔离环境执行 real 链路并只保存脱敏证据。
8. 如后续生成 APK，再执行签名、SHA256、解包密钥扫描、真机安装与启动；否则 AC-DEL-001 和 APK 安全/性能子项保持 NOT EXECUTED。
9. 核对所有证据文件实际存在后，才把对应 AC 改为 PASS/FAIL。

## 7. 风险与已知限制

| 风险/限制 | 影响 | 当前处理 |
| --- | --- | --- |
| 没有 APK artifact | AC-DEL-001 无法执行，APK 安全、启动性能和安装证据不存在 | 明确 `PENDING / NOT EXECUTED`；仅提供 Capacitor 8 教程。 |
| 没有生产 Web/API URL | AC-DEL-002 不能验证公网可访问性、HTTPS 与生产反向代理 | Task 8 或部署任务提供地址后执行。 |
| Real Lanxin 未使用真实凭据验证 | 不能证明真实厂商端点、鉴权和响应契约在生产可用 | 默认 mock；real 失败明确 fallback；保留真实验证门槛。 |
| 通用 gateway 契约可能与最终厂商接口不同 | 可能需要在单一 adapter 中做字段映射 | 部署前确认 endpoint、header 和响应 envelope。 |
| `evidence/` 当前不存在 | 本报告列出的路径都不是现有证据 | Task 8 执行时创建并保存原始、脱敏、可复核 artifact。 |
| 当前系统不执行用户代码 | 无法提供真实 Python runtime 的 stdout/异常语义 | 产品定位为结构化 AI/mock 学习可视化，不作为在线判题器。 |
| 自动化测试尚未在本报告流程执行 | 无法声明已有测试 PASS | 所有 AC 保持 PENDING，Task 8 统一执行。 |

## 8. 缺陷记录

当前未执行统一验收，因此没有可成立的“已发现缺陷”结论。Task 8 发现问题时使用下表追加，不得把未执行项记为“无缺陷”。

| 缺陷 ID | 等级 | 关联 AC | 现象 | 复现步骤 | 证据 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| - | - | - | 尚未执行 | - | - | PENDING |

## 9. 结论

截至 `2026-06-28`，CodeMotion `1.0.0` 已具备 Web、API、mock/real Lanxin 框架和自动化测试文件，但 Task 8 尚未统一执行，证据目录尚未生成，生产地址、真实 Lanxin 和 APK 均未验证。当前验收结论为：**PENDING，不满足最终发布/比赛完整交付门槛**。

本结论不否定 Option A 本阶段的文档与可运行源码交付，但禁止将其表述为“16 个 AC 已通过”或“APK 已交付”。
