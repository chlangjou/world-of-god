# Web PoC v2 — 架構與模組責任

- **Design Authority：** `main/docs/` 是正式規格；此目錄為實驗實作，不回寫正式規則。
- **Kernel：** `src/sim.js` 無 DOM、無 wall-clock，相同 Seed／Profile／操作時序可重現；保留 Original 完整對照。
- **Presentation：** `src/app.js` 處理 Input、Canvas、Hints 與儲存，不自行決定 Miracle／Oracle 的模擬規則。
- **Profile：** `config/balance-agriculture-v0.1.json`（含各聚落糧倉建設）與 `config/religion-propagation-v0.1.json` 分別提供農業／基礎建設與宗教傳播參數。原始 `config/balance-default.json` 只是歷史 DEFAULT_RULES 快照。
- **Styles：** 三份 CSS 區分原始基礎、固定視窗及檔案選單。
- **Guides / Tests：** UI 規格、Agriculture 計算和可重現測試都在本目錄內，避免混入正式遊戲設計文件。
- **Optional Bundle：** 維護多檔案原始碼；必要時才產生 `dist/` 離線單檔，產物不進 Git。

保留 God expresses intent, world determines execution、NPC 自主選擇、真實作物／食物庫存、物理可及共同糧倉、具體因果、Simulation／Rendering 分離、一頁不捲動 UI。

`src/sim.js` 暫時保持單一可測的 JS kernel，以免此次目錄遷移伴隨大量核心重寫。它已與 UI、Style、Profile、Guide 分檔；日後確認有實際維護需求時再分拆 World／Household／Religion／Divine 程式模組。
