# felo-cli

`felo-cli` 是一個 Felo OpenAPI 客戶端，提供：

- 命令列工具（CLI）
- 程式化 API（Node/Bun）

核心行為是呼叫 `https://openapi.felo.ai/v2/chat`，傳送 `query` 後取得回答與參考資料。

## 專案簡介

此專案封裝了 Felo Chat API，聚焦在「快速可用」與「型別安全」：

- CLI 可直接查詢並輸出回答
- 程式可透過 `createFeloClient()` 或 `feloChat()` 整合
- 內建成功/失敗回應解析與錯誤物件（`FeloApiError`）
- 建置輸出放在 `dist/`（至少包含 `dist/index.js` 與 `dist/cli.js`）

## 功能特色

- 支援 `FELO_API_KEY` 環境變數與 `--api-key` 參數
- `query` 會先 `trim()`，並限制長度 `1..2000` 字元
- 成功回傳結構化資料：`answer`、`query_analysis.queries`、`resources`
- 錯誤時提供 `message`、`statusCode`，以及 API 回傳的 `code`、`requestId`
- 可自訂 `baseUrl` 與 `fetchImpl`（方便測試或代理）

## 安裝方式（npm/bun）

### npm

```bash
npm install felo-cli
```

執行（未全域安裝時）：

```bash
npx felo-cli --help
```

### bun

```bash
bun add felo-cli
```

執行：

```bash
bunx felo-cli --help
```

## 快速開始

1. 設定 API Key

```bash
export FELO_API_KEY="your_felo_api_key"
```

PowerShell：

```powershell
$env:FELO_API_KEY="your_felo_api_key"
```

2. 執行查詢

```bash
felo-cli "請用 3 點整理今天的 AI 重要新聞"
```

若你在本專案原始碼中開發：

```bash
bun install
bun run build
node dist/cli.js "請解釋什麼是檢索增強生成（RAG）"
```

## 環境變數（FELO_API_KEY）

- 名稱：`FELO_API_KEY`
- 用途：Felo API Bearer Token
- 優先順序：CLI `--api-key` > `FELO_API_KEY`
- 未提供時會拋出：
  - `Missing FELO_API_KEY. Set FELO_API_KEY or pass apiKey in options.`

## CLI 使用方式（含範例、參數說明）

### 語法

```bash
felo-cli [--api-key <key>] <query>
```

目前原始碼中的等價語法為：

```bash
bun run src/cli.ts [--api-key <key>] <query>
```

### 參數說明

| 參數 | 必填 | 說明 |
| --- | --- | --- |
| `--api-key <key>` | 否 | 覆蓋 `FELO_API_KEY` |
| `-h`, `--help` | 否 | 顯示使用方式 |
| `<query>` | 是 | 查詢字串；`trim()` 後長度需介於 `1..2000` |

### 範例

使用環境變數：

```bash
felo-cli "幫我整理 TypeScript 5.9 重點"
```

直接帶 key：

```bash
felo-cli --api-key "sk-xxxx" "比較 Bun 與 Node.js 的適用情境"
```

多字查詢（會自動合併為單一 query）：

```bash
felo-cli 請 說明 向量資料庫 的 主要用途
```

### 輸出格式

成功時：

1. 第一行輸出 `answer`
2. 若有 `resources`，會再輸出：
   - `Resources:`
   - 每筆資源的 `title`、`link`、`snippet`（snippet 可能為空）

失敗時（stderr）會輸出：

- `Error: <message>`
- 若有 API 錯誤碼：`Code: <code>`
- 若有 request id：`Request ID: <request_id>`

## 程式化 API 使用方式（Node/Bun）

套件匯出重點：

- `createFeloClient(options)`
- `feloChat(query, options)`
- `FeloApiError`
- `FELO_BASE_URL`

### Node（ESM）

```ts
import { createFeloClient, FeloApiError } from "felo-cli";

const client = createFeloClient({
  apiKey: process.env.FELO_API_KEY,
});

try {
  const data = await client.chat("請整理零信任架構重點");
  console.log(data.answer);
  console.log(data.resources);
} catch (error) {
  if (error instanceof FeloApiError) {
    console.error(error.message, error.code, error.requestId, error.statusCode);
  } else {
    console.error(error);
  }
}
```

### Bun

```ts
import { feloChat } from "felo-cli";

const data = await feloChat("幫我列出 5 個可實作的 side project", {
  apiKey: process.env.FELO_API_KEY,
});

console.log(data.answer);
```

### 自訂 baseUrl / fetch

```ts
import { createFeloClient } from "felo-cli";

const client = createFeloClient({
  apiKey: process.env.FELO_API_KEY,
  baseUrl: "https://openapi.felo.ai",
  fetchImpl: fetch,
});
```

## 錯誤處理與常見問題

### 1) `Missing FELO_API_KEY...`

未設定環境變數且未傳 `--api-key` / `apiKey`。  
請先設定 `FELO_API_KEY`，或在呼叫時直接提供 key。

### 2) `Query length must be between 1 and 2000 characters.`

查詢在 `trim()` 後為空字串，或長度超過 2000。  
請縮短或補齊查詢內容。

### 3) `Missing value for --api-key.`

CLI 使用了 `--api-key` 但沒有給值。  
請改成 `--api-key <你的 key>`。

### 4) API 失敗時如何取得更多資訊？

捕捉 `FeloApiError`，讀取：

- `message`
- `statusCode`
- `code`（API 錯誤碼）
- `requestId`（可用於回報問題）

## 開發流程（install/test/typecheck/build）

```bash
bun install
bun run test
bun run typecheck
bun run build
```

- `test`：執行 Bun 測試
- `typecheck`：執行 TypeScript 型別檢查（不輸出檔案）
- `build`：將程式建置到 `dist/`

## 發佈到 npm 的建議流程

以下為 `felo-cli` 套件建議流程（發佈前）：

1. 確認 `package.json` 的發佈設定（例如 `name: "felo-cli"`、`private: false`、`bin` 指向 `dist/cli.js`）。
2. 執行品質檢查與建置：
   ```bash
   bun run test
   bun run typecheck
   bun run build
   ```
3. 檢查打包內容（確認含 `dist/`）：
   ```bash
   npm pack --dry-run
   ```
4. 登入並發佈：
   ```bash
   npm publish --access public
   ```

## 授權

本專案採用 **MIT License**。詳見 [`LICENSE`](./LICENSE)。
