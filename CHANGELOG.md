# 變更日誌

本專案所有重要變更皆記錄於此，格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)。

## [0.1.5] - 2026-02-27

### 改善
- CLI 改用更完整的引數解析流程，並新增 `--version` 與 `--raw` 參數。
- 非 `--json` 模式下，預設會將 `answer` 以 Markdown 渲染後輸出到終端；若需原始 markdown 可使用 `--raw`。
- 未提供任何參數時，改為直接顯示 help 說明，不再回傳錯誤。
- `--help` 內容補上 `FELO_API_KEY` 環境變數使用說明。

### 修正
- 當 API 回應包含不規範縮排（例如全形編號搭配縮排清單）而導致 `**粗體**` 未被 Markdown 轉譯時，CLI 會套用粗體 fallback，避免粗體語法原樣顯示。
- `--raw` 與 `--json` 改為互斥，避免同時指定時產生語意衝突的輸出行為。

### 測試
- 更新 CLI 測試，涵蓋 `--version`、`--raw`、無參數顯示 help，以及 help 內容中的 `FELO_API_KEY` 說明。
- 補強預設輸出為 Markdown 渲染結果的驗證。

### 文件
- `AGENTS.md` 新增變更管理規範：每次程式碼修正都必須同步更新 `CHANGELOG.md`。
- `skill/felo-cli/SKILL.md` 更新 CLI 使用建議：在 Skill 取得內容時固定使用 `--json`，以保留完整結構化回應。

## [0.1.4] - 2026-02-27

### 改善
- CLI 預設成功輸出改為僅顯示 `answer`，不再自動列出 `resources`；如需完整結構化資料請使用 `--json`。
- `skill/felo-cli/` 文件改為「本專案工具優先」：先使用 `npx -y @willh/felo-cli` 與 SDK（`createFeloClient` / `feloChat`），直接呼叫 API 僅作驗證與除錯用途。
- Skill 名稱改為 `felo-cli`，並將目錄從 `skill/felo-api/` 重新命名為 `skill/felo-cli/`。

### 測試
- 更新 CLI 測試以符合預設僅輸出 `answer` 的行為，並維持 `--json` 回傳完整資料的驗證。
- 更新 skill 文件測試路徑與描述，對齊 `skill/felo-cli/` 新目錄與 skill 名稱。

### 文件
- `AGENTS.md` 補充預設輸出策略與執行期注意事項，降低 CLI 使用與除錯時的誤解成本。

## [0.1.3] - 2026-02-27

### 新增
- `--json` 參數：直接將 Felo Open API 原始回應以 JSON 格式輸出至 stdout，略過格式化的答案與資源清單。

### 修正
- 放寬 `resources[].snippet` 解析：當 API 回傳 `null` 或遺漏 `snippet` 欄位時，會正規化為空字串，避免合法回應被判定為格式錯誤。
- 新增 HTTP 200 內嵌錯誤格式處理：支援 `{ "error": { "code", "summary", "detail" } }`，可轉為 `FeloApiError` 並保留錯誤碼。
- API 空回應（empty body）改為固定錯誤訊息 `Felo API returned an empty response.`，與「非預期成功 payload」錯誤分流。

### 測試
- 補上用戶端測試：涵蓋內嵌錯誤格式、`snippet` 為 `null`/遺漏、以及空回應 body 的錯誤訊息。

### 文件
- `AGENTS.md` 新增已知執行期行為：`npm run ... --json` 旗標攔截、`snippet` 非穩定欄位、內嵌錯誤格式與錯誤訊息對照。
- `README.md` 補上官方 Open Platform 文件連結與文字修正。

## [0.1.2] - 2026-02-27

### 改善
- CI 工作流程改用 `npm view` 取得已發佈版本，簡化版號比較邏輯。
- 將 CI 執行環境的 Node.js 升級至第 22 版。
- 發佈工作加入 `provenance` 與必要的 `id-token`、`contents` 權限設定。

## [0.1.1] - 2026-02-27

### 新增
- `--debug` 參數：將除錯資訊輸出至 stderr，包含引數解析、API 呼叫與回應元資料。
- CI 工作流程：推送時自動比對版號，若有異動則發佈至 npm。
- `AGENTS.md`：說明專案架構、常規、測試策略與技術規範，供 AI 代理人參考。

## [0.1.0] - 2026-02-27

### 新增
- 初始版本發佈。
- `felo-cli` 命令列工具，支援 `--api-key` 參數與 `FELO_API_KEY` 環境變數。
- `createFeloClient` / `feloChat` SDK 核心，呼叫 `POST /v2/chat` 並驗證回應結構。
- 結構化錯誤類別 `FeloApiError`，保留 HTTP 狀態碼、錯誤代碼與 Request ID。
- `skill/felo-cli/` 技能文件，含 API 合約與工作流程參考文件。
- 完整測試套件（CLI、用戶端、Skill 文件一致性）。
