# CodeMotion 部署指南

本文覆盖 Windows PowerShell 下的本地开发、mock/real Lanxin 切换、生产 Web + API 部署，以及使用 Capacitor 8 从本地 `dist` 打包 Android APK 的完整步骤。

> 当前 Option A 阶段没有生成 APK artifact。APK 章节是可执行教程，不代表相关构建、签名或真机验证已经完成。

## 1. 系统要求

### Web 与 API 本地运行

- Windows 10/11 或等价开发环境。
- Node.js `>=20`。
- pnpm `11`；仓库声明版本为 `pnpm@11.7.0`。
- Git。

执行目录：任意目录。

```powershell
node --version
pnpm --version
git --version
```

### Capacitor 8 Android 打包

Capacitor 8 的官方当前最低要求高于本项目普通 Web/API 运行要求：

- Node.js `>=22`。
- Android Studio `>=2025.2.1`。
- Android SDK Tools，以及 API Level `>=24` 的 Android SDK Platform。
- Android SDK Platform-Tools（包含 `adb`）和 Build-Tools（包含 `apksigner`）。

打包前在 Android Studio 的 **Tools > SDK Manager** 安装上述组件。官方依据：

- [Installing Capacitor](https://capacitorjs.com/docs/getting-started)
- [Capacitor Environment Setup](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Capacitor Android](https://capacitorjs.com/docs/android)
- [Capacitor Config](https://capacitorjs.com/docs/config)

## 2. 安装依赖

执行目录：仓库根目录 `C:\Users\lqh22\Documents\vivoAigc`。

```powershell
pnpm install --frozen-lockfile
```

`--frozen-lockfile` 要求 `package.json` 与 `pnpm-lock.yaml` 一致，不会自动改写锁文件。

## 3. 环境变量

### API 环境变量

开发时可复制占位模板；不要提交生成的 `.env`。

执行目录：仓库根目录。

```powershell
Copy-Item -LiteralPath .\apps\api\.env.example -Destination .\apps\api\.env
```

`apps/api/.env` 支持以下变量：

| 变量 | 必需性 | 默认/示例 | 说明 |
| --- | --- | --- | --- |
| `PORT` | 可选 | `3000` | API 监听端口，必须为正整数。 |
| `NODE_ENV` | 可选 | `development` | Node 运行环境标识；生产使用 `production`。 |
| `LLM_MODE` | 可选 | `mock` | 只能是 `mock` 或 `real`。 |
| `LANXIN_API_URL` | real 必需 | `https://api.example.com/...` | 通用 Lanxin gateway 的完整 HTTPS POST 地址。 |
| `LANXIN_APP_ID` | real 必需 | 服务端 Secret | 请求头和请求体使用的应用 ID。 |
| `LANXIN_APP_KEY` | real 必需 | 服务端 Secret | 仅 API 进程读取，用于 Bearer Authorization。 |
| `FRONTEND_ORIGIN` | 可选 | `http://localhost:5173` | 浏览器 CORS 允许来源。生产 Web 与 Capacitor 可用英文逗号分隔，例如 `https://web.example.com,https://localhost`；`*` 仅适合明确允许任意来源的非凭据场景。 |

示例 mock 配置：

```env
PORT=3000
NODE_ENV=development
LLM_MODE=mock
FRONTEND_ORIGIN=http://localhost:5173
```

示例生产 real 配置只使用占位符：

```env
PORT=3000
NODE_ENV=production
LLM_MODE=real
LANXIN_API_URL=https://api.example.com/v1/chat/completions
LANXIN_APP_ID=replace_in_server_secret_store
LANXIN_APP_KEY=replace_in_server_secret_store
FRONTEND_ORIGIN=https://web.example.com,https://localhost
```

`https://localhost` 是 Capacitor Android WebView 的默认安全来源。若实际原生配置修改了 hostname 或 scheme，应把对应精确 origin 加入 `FRONTEND_ORIGIN`。

> CORS 只是浏览器的跨源读取策略，不是 API 鉴权或配额保护。当前 API 明确允许没有 `Origin` header 的直接客户端访问，因此脚本、移动客户端或服务端请求不受 `FRONTEND_ORIGIN` 限制。生产 real 模式必须按第 8 节在反向代理或 API gateway 增加访问控制，不能依赖 CORS 保护 Lanxin 配额。

### Web 构建变量

`VITE_API_BASE_URL` 是公开的构建时变量，默认值为空：

```env
VITE_API_BASE_URL=
```

- 空值表示使用当前 Web origin 下的相对 `/api/...`，适用于同源反向代理。
- 非空值必须是纯 HTTP(S) origin，例如 `https://api.example.com`。
- 不得包含 path、query、fragment 或用户信息；不要填写 `https://api.example.com/api`、`https://api.example.com?token=...` 等值。
- `VITE_*` 会进入 Web 构建产物和 APK，只能保存公开 API origin，绝不能保存长期密钥、Bearer token 或 Lanxin 凭据。

## 4. 本地启动

### API

执行目录：仓库根目录。

```powershell
pnpm dev:api
```

另开一个 PowerShell。执行目录：仓库根目录。

```powershell
Invoke-RestMethod -Method Get -Uri http://localhost:3000/api/health | ConvertTo-Json
```

预期包含 `ok: true`、`service: "codemotion-api"`、`version: "1.0.0"` 和当前 `llmMode`。

### Web

执行目录：仓库根目录。

```powershell
pnpm dev:web
```

访问 <http://localhost:5173>。Vite 开发服务器把 `/api` 代理到 `http://localhost:3000`。

## 5. Mock 与 real 切换

### Mock 模式

1. 在 `apps/api/.env` 设置 `LLM_MODE=mock`。
2. 重启 API。
3. 发起分析并检查响应 `source`。

执行目录：仓库根目录。

```powershell
$Body = @{
  language = 'python'
  code = "print('hello')"
  visualizationFocus = 'auto'
  userLevel = 'beginner'
} | ConvertTo-Json

$Result = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/analyze-code -ContentType 'application/json; charset=utf-8' -Body $Body
$Result | Select-Object requestId, title, source, warnings | ConvertTo-Json -Depth 5
```

预期 `source` 为 `mock`。

### Real 模式

1. 只在 `apps/api/.env` 或部署平台服务端 Secret 中设置 `LLM_MODE=real` 和三项 `LANXIN_*` 变量。
2. 确保 gateway 使用 HTTPS，并确认其契约与下节一致。
3. 重启 API，再执行同一分析请求。

结果解释：

- `source: "lanxin"`：gateway 请求成功，模型内容通过 JSON 解析与 Zod 结构校验。
- `source: "fallback"`：已进入 real 路径，但配置、网络、45 秒超时、HTTP 状态、响应 JSON、模型 JSON 或业务 schema 任一环节失败，后端明确返回稳定 mock 降级结果。
- `source: "mock"`：API 当前运行在 `LLM_MODE=mock`。

`/api/health` 的 `llmMode: "real"` 只证明进程配置为 real，**不能证明某次请求实际调用了 Lanxin**；必须检查 `/api/analyze-code` 或 `/api/tutor-chat` 的 `source`。

## 6. 通用 Lanxin gateway 契约

当前适配器没有绑定某个公开厂商端点。`LANXIN_API_URL` 指向的 gateway 必须接受：

```http
POST <LANXIN_API_URL>
content-type: application/json
x-lanxin-app-id: <LANXIN_APP_ID>
Authorization: Bearer <LANXIN_APP_KEY>
```

请求体：

```json
{
  "appId": "<LANXIN_APP_ID>",
  "messages": [
    { "role": "user", "content": "<CodeMotion schema-constrained prompt>" }
  ],
  "temperature": 0.2
}
```

gateway 响应本身必须是 JSON。适配器可从以下任一种位置提取模型文本：

- 顶层 JSON 字符串；
- `{ "content": "..." }`；
- `{ "data": { "content": "..." } }`；
- `{ "choices": [{ "message": { "content": "..." } }] }`。

提取出的 `content` 必须是 JSON 对象，可为纯 JSON、`json` fenced block，或包含一个可提取 JSON 对象的文本。代码分析内容必须符合 `CodeAnalyzeResponse`，导师内容必须符合 `TutorChatResponse`。后端会强制把成功真实结果的 `source` 规范为 `lanxin`，并对完整结构做 Zod 校验。

适配器超时为 **45 秒**。请求失败、非 2xx、响应不是 JSON、模型内容不是 JSON、结构校验失败或超时都会触发 `fallback`；原始上游错误和凭据不会返回前端。

## 7. API 输入边界

- `/api/analyze-code`：`language` 固定为 `python`；代码非空，最多 12,000 字符、200 行；`stdin` 最多 4,000 字符。
- `/api/tutor-chat`：问题非空且最多 500 字符；摘要最多 3,000 字符。
- API JSON 请求体上限为 64 KB。
- API 不执行提交的 Python 代码。

## 8. 生产 Web + API 部署

### 构建 API 与准备部署包

构建机必须保留完整 workspace 上下文，先安装锁定依赖并执行完整构建。

执行目录：构建机的仓库根目录。

```powershell
pnpm install --frozen-lockfile
pnpm build
```

API 部署包必须保持以下相对路径，不能只复制 `apps/api/dist` 后再调用根 workspace 的 `--filter` 命令：

```text
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
apps/
  api/
    package.json
    dist/
```

把上述文件传到目标机后，从目标机部署根目录安装生产依赖。

执行目录：目标机部署根目录，即包含根 `package.json` 和 `pnpm-lock.yaml` 的目录。

```powershell
pnpm install --frozen-lockfile --prod
```

通过进程管理器、容器平台或服务管理器注入第 3 节 API 环境变量；从部署根目录直接启动编译结果。不要依赖 `apps/api/.env`，也不要把真实 Secret 写入启动命令或 shell 历史。

执行目录：目标机部署根目录。

```powershell
node .\apps\api\dist\server.js
```

PM2、systemd、Windows Service 或容器的等价配置必须把 working directory 设为部署根目录，并以 `node apps/api/dist/server.js` 作为实际进程命令。

### 构建 Web

若 Web 与 API 由同一域名反向代理，保持 `VITE_API_BASE_URL` 为空，使用相对 `/api`。

执行目录：仓库根目录。

```powershell
Remove-Item Env:VITE_API_BASE_URL -ErrorAction SilentlyContinue
pnpm --filter @codemotion/web build
```

若 Web 与 API 分属不同域名，在构建时设置公开的 HTTPS API origin。该值必须只有 scheme、host 和可选 port，不得包含 `/api` path、query、fragment 或任何密钥。

执行目录：仓库根目录。

```powershell
$env:VITE_API_BASE_URL = 'https://api.example.com'
pnpm --filter @codemotion/web build
Remove-Item Env:VITE_API_BASE_URL
```

静态产物位于 `apps/web/dist`。静态托管必须为 SPA 配置未知路径回退到 `index.html`。

### 反向代理与 CORS

当前 CodeMotion API **未实现 API 用户鉴权、速率限制、请求配额或最大并发控制**。这是本阶段明确限制，也是生产部署方的责任。real 模式会消耗上游 Lanxin 配额，公开部署前必须在反向代理或 API gateway 同时落实：

1. 按客户端、IP 或鉴权主体执行速率限制。
2. 设置日/月请求配额或等价预算上限，并对异常消耗告警。
3. 设置每个客户端及服务整体的最大并发，防止请求堆积到上游。
4. 对内部演示使用网络隔离或 IP allowlist；对公网服务使用适当的服务端 API key、短期 token、JWT/OIDC 或其他鉴权，并在 gateway 校验。
5. 长期鉴权 Secret 只保存在受控后端或 gateway；不得编译进 Web、`VITE_*` 或 APK。

`FRONTEND_ORIGIN` 只能控制受浏览器 CORS 约束的读取。没有 `Origin` 的 `curl`、脚本、原生客户端和服务端调用仍可直达当前 API，因此 CORS 配置成功不代表上述保护已经完成。

推荐同源结构：

```text
https://codemotion.example.com/      -> apps/web/dist
https://codemotion.example.com/api/  -> http://127.0.0.1:3000/api/
```

Nginx 配置示意。`limit_req_zone` 和 `limit_conn_zone` 放在 `http` context；示例只提供基础 IP 速率和并发限制，请求配额与服务端鉴权仍应由 API gateway 或独立鉴权层实施。

```nginx
# http context
limit_req_zone $binary_remote_addr zone=codemotion_rate:10m rate=2r/s;
limit_conn_zone $binary_remote_addr zone=codemotion_conn:10m;

server {
    listen 443 ssl http2;
    server_name codemotion.example.com;

    root /srv/codemotion/apps/web/dist;
    index index.html;

    location /api/ {
        limit_req zone=codemotion_rate burst=10 nodelay;
        limit_conn codemotion_conn 4;
        client_max_body_size 64k;

        proxy_pass http://127.0.0.1:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

跨域部署时：

1. Web 构建使用 `VITE_API_BASE_URL=https://api.example.com`。
2. API 设置 `FRONTEND_ORIGIN=https://web.example.com`。
3. 同时服务 Capacitor APK 时加入 `https://localhost`。
4. Web 和 API 都使用有效 HTTPS 证书；不要依赖 Android 明文 HTTP 放行。
5. 单独验证 gateway 的鉴权、速率、配额、最大并发和网络/IP 策略；CORS 验证不能替代这些检查。

### 生产验证

执行目录：仓库根目录。

```powershell
Invoke-RestMethod -Uri https://api.example.com/api/health | ConvertTo-Json
Invoke-WebRequest -Uri https://web.example.com -UseBasicParsing | Select-Object StatusCode
```

随后在浏览器 Network 面板确认分析请求目标地址、HTTP 200 和响应 `source`。

## 9. Capacitor 8 APK 完整教程

### 9.1 重要边界

本教程把 `apps/web/dist` 的本地静态文件复制进 APK。`capacitor.config.ts` **不配置生产 `server.url`**。APK 只通过 `VITE_API_BASE_URL` 访问外部 HTTPS API，绝不能把 `LANXIN_APP_KEY` 放入 `VITE_*`、Web 源码或 APK。

以下操作会给 `apps/web` 增加 Capacitor 依赖并创建 `android/`，应在专门的后续打包分支执行；本 Task 7 不执行这些命令。

### 9.2 安装 Capacitor 8

执行目录：`C:\Users\lqh22\Documents\vivoAigc\apps\web`。

```powershell
pnpm add @capacitor/core@^8 @capacitor/android@^8
pnpm add -D @capacitor/cli@^8
```

### 9.3 配置应用名、包名和本地 dist

在 `apps/web/capacitor.config.ts` 创建：

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.codemotion.app',
  appName: 'CodeMotion',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
```

- `appName` 是设备显示名称。
- `appId` 是 Android application ID；首次发布前替换为组织控制的反向域名，并在创建 Android 工程前确定。
- `webDir: 'dist'` 指向 Vite 本地构建产物。
- `server` 只固定本地 WebView 的 HTTPS scheme，不设置 `url`。

### 9.4 构建 Web 并创建 Android 工程

先保证生产 API 已通过 HTTPS 可访问，并允许 CORS origin `https://localhost`。

执行目录：`C:\Users\lqh22\Documents\vivoAigc\apps\web`。

```powershell
$env:VITE_API_BASE_URL = 'https://api.example.com'
pnpm build
Remove-Item Env:VITE_API_BASE_URL
```

确认本地 `dist/index.html` 存在。

执行目录：`C:\Users\lqh22\Documents\vivoAigc\apps\web`。

```powershell
Test-Path -LiteralPath .\dist\index.html
pnpm exec cap add android
pnpm exec cap sync android
pnpm exec cap open android
```

以后每次 Web 代码或 `VITE_API_BASE_URL` 改变，都必须重新 `pnpm build`，再执行：

执行目录：`C:\Users\lqh22\Documents\vivoAigc\apps\web`。

```powershell
pnpm exec cap sync android
```

### 9.5 应用图标

准备至少 1024 x 1024 的无透明边缘方形源图。打开 Android Studio 后：

1. 在 `android/app/src/main/res` 上选择 **New > Image Asset**。
2. 选择 **Launcher Icons (Adaptive and Legacy)**。
3. 设置前景、背景和圆形预览，Resource Name 保持 `ic_launcher`。
4. 检查 `mipmap-*` 预览后完成生成。
5. 在浅色/深色桌面和真实设备上确认图标清晰、无裁切。

### 9.6 Debug 真机验证

在 Android 设备启用开发者选项和 USB 调试，连接后授权电脑。

执行目录：任意目录。

```powershell
adb devices
```

设备状态应为 `device`，不是 `unauthorized`。可在 Android Studio 选择设备后点击 Run，或使用：

执行目录：`C:\Users\lqh22\Documents\vivoAigc\apps\web`。

```powershell
pnpm exec cap run android
```

验证应用名、首屏、分析请求、`source`、离线提示、返回键和前后台切换。若 API 证书无效或 `FRONTEND_ORIGIN` 未包含 `https://localhost`，真机请求会失败。

### 9.7 生成 signed APK

Android Studio 官方流程见[Sign your app](https://developer.android.com/studio/publish/app-signing?hl=en)：

1. 选择 **Build > Generate Signed Bundle / APK**。
2. 选择 **APK**，模块选择 `app`。
3. 首次构建选择 **Create new...** 创建 `.jks` keystore、alias 和长有效期证书；已有发布应用必须继续使用原 keystore。
4. 选择 `release` variant，启用可用的签名版本，完成构建。
5. 点击构建通知中的 **Locate** 定位文件。

keystore 不得放入仓库、Web `dist`、APK 交付目录或公开网盘。至少保存两份加密备份，把 keystore 密码和 alias 密码放入受控密码管理器。丢失发布签名密钥可能导致无法以同一 application ID 更新应用。

查找生成结果：

执行目录：`C:\Users\lqh22\Documents\vivoAigc\apps\web`。

```powershell
Get-ChildItem -LiteralPath .\android -Recurse -Filter *.apk |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 10 FullName, Length, LastWriteTime
```

常见 release 路径是 `android/app/build/outputs/apk/release/app-release.apk`。需要形成后续交付物时再复制并规范命名：

执行目录：仓库根目录。

```powershell
New-Item -ItemType Directory -Path .\dist -Force | Out-Null
Copy-Item -LiteralPath .\apps\web\android\app\build\outputs\apk\release\app-release.apk -Destination .\dist\CodeMotion-1.0.0.apk
```

### 9.8 签名、安装和校验和

`apksigner` 官方用法见[Android apksigner](https://developer.android.com/tools/apksigner)。按本机 SDK Build-Tools 版本调整路径。

执行目录：仓库根目录。

```powershell
$SdkRoot = $env:ANDROID_HOME
if (-not $SdkRoot) { $SdkRoot = $env:ANDROID_SDK_ROOT }
$ApkSigner = Get-ChildItem -LiteralPath (Join-Path $SdkRoot 'build-tools') -Recurse -Filter apksigner.bat |
  Sort-Object FullName -Descending |
  Select-Object -First 1 -ExpandProperty FullName
& $ApkSigner verify --verbose --print-certs .\dist\CodeMotion-1.0.0.apk
```

执行目录：仓库根目录。

```powershell
adb install -r .\dist\CodeMotion-1.0.0.apk
```

执行目录：仓库根目录。

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath .\dist\CodeMotion-1.0.0.apk |
  Format-List Algorithm, Hash, Path
```

把签名验证输出、SHA256、安装截图和首屏截图保存为 Task 8 证据；未执行前不得在测试报告中标记 PASS。

### 9.9 APK 解包密钥扫描

先使用不包含完整密钥的唯一片段检查 APK；输入内容只存在当前 PowerShell 会话，不写入脚本或文档。扫描结果只输出路径和命中数，禁止输出或保存原始匹配行。

执行目录：仓库根目录。

```powershell
$SecretFingerprint = Read-Host '输入真实 AppKEY 的唯一短片段（不要输入完整密钥）'
$ScanRoot = Join-Path $env:TEMP 'codemotion-apk-scan'
if (Test-Path -LiteralPath $ScanRoot) { Remove-Item -LiteralPath $ScanRoot -Recurse -Force }
New-Item -ItemType Directory -Path $ScanRoot | Out-Null
Copy-Item -LiteralPath .\dist\CodeMotion-1.0.0.apk -Destination (Join-Path $ScanRoot 'app.zip')
Expand-Archive -LiteralPath (Join-Path $ScanRoot 'app.zip') -DestinationPath (Join-Path $ScanRoot 'unpacked') -Force
$FingerprintFindings = @(
  Get-ChildItem -LiteralPath (Join-Path $ScanRoot 'unpacked') -Recurse -File -ErrorAction SilentlyContinue |
    Select-String -SimpleMatch -Pattern $SecretFingerprint -ErrorAction SilentlyContinue
)
$FingerprintGroups = @($FingerprintFindings | Group-Object Path)
$FingerprintGroups | Select-Object @{Name='Path'; Expression={$_.Name}}, Count
[pscustomobject]@{ MatchedFiles = $FingerprintGroups.Count; Matches = $FingerprintFindings.Count }
$FingerprintFindings = $null
$FingerprintGroups = $null
$SecretFingerprint = $null
```

无输出不等于自动 PASS：还要扫描 `LANXIN_APP_KEY`、可疑 Authorization 值和组织使用的密钥格式，并人工复核命中项。

执行目录：仓库根目录。

```powershell
$PatternFindings = @(
  Get-ChildItem -LiteralPath (Join-Path $ScanRoot 'unpacked') -Recurse -File -ErrorAction SilentlyContinue |
    Select-String -Pattern 'LANXIN_APP_KEY','Authorization\s*[:=]\s*Bearer','x-lanxin-app-id' -ErrorAction SilentlyContinue
)
$PatternGroups = @($PatternFindings | Group-Object Path)
$PatternGroups | Select-Object @{Name='Path'; Expression={$_.Name}}, Count
[pscustomobject]@{ MatchedFiles = $PatternGroups.Count; Matches = $PatternFindings.Count }
$PatternFindings = $null
$PatternGroups = $null
```

不要把 `$FingerprintFindings`、`$PatternFindings` 或 `Select-String` 的原始 `MatchInfo` 写到控制台、日志或证据文件；它们含完整匹配行。Task 8 只保存上面的 Path/Count 汇总。

### 9.10 更新版本

发布更新时必须：

1. 保持 `appId` 不变并使用同一发布 keystore。
2. 更新 Web/API `package.json` 版本和 Android `versionCode`、`versionName`；`versionCode` 必须递增。
3. 用目标 HTTPS API 地址重建 Web，执行 `cap sync android`。
4. 重新完成自动化测试、真机回归、签名验证、SHA256 和解包密钥扫描。
5. 以新版本号命名 APK，不覆盖旧版本证据。

## 10. 敏感信息扫描

### 已跟踪源码与文档

使用真实密钥的唯一短片段扫描，避免把完整密钥写进 shell 历史。`git grep -c` 只输出 `文件名:命中数`，禁止改用 `-n` 或保存完整匹配行。

执行目录：仓库根目录。

```powershell
$SecretFingerprint = Read-Host '输入真实 AppKEY 的唯一短片段（不要输入完整密钥）'
$FingerprintCounts = @(git grep -c -I --fixed-strings -- $SecretFingerprint 2>$null)
$FingerprintCounts
[pscustomobject]@{ MatchedFiles = $FingerprintCounts.Count }
$FingerprintCounts = $null
$SecretFingerprint = $null
```

检查可能的硬编码凭据模式；`.env.example` 中的变量名和占位符属于预期命中，必须人工区分。

执行目录：仓库根目录。

```powershell
$PatternCounts = @(git grep -c -I -E 'LANXIN_APP_KEY=.+|Authorization.{0,20}Bearer|x-lanxin-app-id' 2>$null)
$PatternCounts
[pscustomobject]@{ MatchedFiles = $PatternCounts.Count }
$PatternCounts = $null
```

### Web 构建产物

执行目录：仓库根目录。

```powershell
$SecretFingerprint = Read-Host '输入真实 AppKEY 的唯一短片段（不要输入完整密钥）'
$WebFindings = @(
  Get-ChildItem -LiteralPath .\apps\web\dist -Recurse -File -ErrorAction SilentlyContinue |
    Select-String -SimpleMatch -Pattern $SecretFingerprint -ErrorAction SilentlyContinue
)
$WebGroups = @($WebFindings | Group-Object Path)
$WebGroups | Select-Object @{Name='Path'; Expression={$_.Name}}, Count
[pscustomobject]@{ MatchedFiles = $WebGroups.Count; Matches = $WebFindings.Count }
$WebFindings = $null
$WebGroups = $null
$SecretFingerprint = $null
```

不要输出或保存 `$WebFindings`、`Select-String` 原始结果或完整匹配行；证据只保留 Path/Count 汇总。

如团队已安装 Gitleaks，再运行完整历史扫描并只保留 `--redact` 后的脱敏输出。

执行目录：仓库根目录。

```powershell
gitleaks git . --redact
```

## 11. 测试命令

执行目录：仓库根目录。

```powershell
pnpm test
pnpm build
```

这些命令验证已有自动化测试和 TypeScript/Vite 构建，但不能代替 Task 8 的生产地址、真实 Lanxin、Android 签名、真机、性能和证据验收。

## 12. 常见问题

### `node` 找不到或版本过低

Web/API 使用 Node `>=20`；Capacitor 8 使用 Node `>=22`。重新打开 PowerShell，确认 PATH 后再检查 `node --version`。

### `pnpm install --frozen-lockfile` 失败

说明 manifest 与锁文件不一致。不要在交付验证时绕过；先确认是否存在未提交的依赖变更，并由负责实现的任务更新锁文件。

### Web 显示“服务离线”

确认 API 在 3000 端口运行；本地检查 Vite 代理，生产检查 `VITE_API_BASE_URL` 或 `/api` 反向代理。浏览器 Network 中不得出现证书、CORS 或 mixed-content 错误。

### 健康检查是 real，但分析结果是 fallback

`llmMode` 只表示配置。检查 gateway URL、服务端 Secret、上游 HTTP 状态和返回契约；适配器在 45 秒后超时，并会对模型 JSON 做严格 schema 校验。

### Capacitor 打包后仍请求旧 API

`VITE_API_BASE_URL` 是构建时变量。重新设置变量、执行 `pnpm build`、`pnpm exec cap sync android`，再重装 APK。

### Android 请求出现 CORS

把 `https://localhost` 加入 API 的 `FRONTEND_ORIGIN` 并重启 API。不要把 `*` 当作默认生产修复。

### 已配置 CORS，但 API 仍可被脚本直接调用

这是浏览器 CORS 的正常边界，不是鉴权缺陷修复。当前 API 允许无 `Origin` 请求且没有用户鉴权；生产 real 模式必须在反向代理/API gateway 配置鉴权或网络/IP策略、速率限制、请求配额和最大并发。不要把长期 API key 放进 Web 或 APK 作为补救。

### Android 出现明文 HTTP 或证书错误

生产 API 必须使用受设备信任的 HTTPS 证书。不要把 `server.url` 指向开发机，也不要通过把 AppKEY 放入 APK 来规避后端。

### `adb devices` 显示 `unauthorized`

解锁设备并接受 USB 调试授权；必要时撤销设备上的 USB 调试授权后重新连接。

### `apksigner` 找不到

在 Android Studio SDK Manager 安装 Build-Tools，确认 `ANDROID_HOME` 或 `ANDROID_SDK_ROOT` 指向实际 SDK。

### 安装更新时报签名不一致

新旧 APK 使用了不同 keystore。测试设备可先卸载旧包，但正式更新必须恢复原发布 keystore，不能通过改包名冒充同一应用更新。
