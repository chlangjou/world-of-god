# World of God — Web PoC v2

這是從 `web-mvp-0` 移入 `main/poc/v2/` 的**獨立模組化 Web 試玩版**。
不改動 `main/docs/` 正式 God–World 規則，也不取代 Godot PoC。

## 快速啟動

需要 Node.js 18 以上，無外部套件，**不用 npm install**：

```sh
cd poc/v2
npm start
```

開啟 **http://localhost:8000/**。新世界預設 Agriculture v0.1，
可選 Original 做 A/B。因為 JSON Profile 由瀏覽器 `fetch` 載入，
**不要直接使用 `file://` 雙擊原始 `index.html`**。

只有需要傳送離線單檔時，才執行 `npm run build:standalone`，
將產物輸出到不受 Git 管理的 `dist/`。平時都編輯多檔案原始碼。

## 檔案分工

| 目錄／檔案 | 責任 |
| --- | --- |
| `index.html` | 主 UI 結構 |
| `src/sim.js` | 無 DOM、可重現的模擬核心 |
| `src/app.js` | 畫面、使用者操作、Profile 與存檔 |
| `assets/style-base.css` | 配色、基本元件 |
| `assets/viewport.css` | 單頁無垂直捲動、Miracle／Oracle 雙層面板 |
| `assets/file-menu.css` | 檔案與窄螢幕操作 |
| `config/balance-agriculture-v0.1.json` | 目前可用的 Agriculture、成家、拓荒實驗數值 |
| `config/religion-propagation-v0.1.json` | 居民閒暇傳道、家庭教育及聚落宗教傳播參數 |
| `config/balance-default.json` | Original 的唯讀快照；核心預設仍在 `src/sim.js` |
| `docs/` | Architecture、UI Guide、Agriculture 驗算紀錄 |
| `tests/` | 核心回歸、資產分離驗證及 Smoke |
| `tools/` | 跨平台 HTTP server、離線打包、獨立驗算 |

Religion Propagation v0.1 讓成人信徒在空閒時間傳道、兒童從虔誠家庭逐步形成信仰、鄰近聚落自然交流，並讓 Priest 轉傳 Saint 的 Oracle；宗教狀態可在聚落檢視。[詳細機制](docs/RELIGION_PROPAGATION.md)。

正式規格： [Core Principles](../../docs/CORE_PRINCIPLES.md)、
[Population](../../docs/POPULATION_MODEL.md)、
[Settlement Economy](../../docs/SETTLEMENT_ECONOMY_OCCUPATIONS.md)。

## 基本檢查

```sh
npm test
npm run smoke
npm run check:agriculture
npm run build:standalone  # 可選，dist/ 不入庫
```

測試涵蓋 4,000 日農業、土地資源守恆、自主成家、多聚落、宗教家庭傳承、傳道、Oracle 接力與可重現性；
仍需實際瀏覽器檢查 1280×720／1366×768／1920×1080 佈局。

## 存檔

v2 採用獨立的瀏覽器 key `wog-poc-v2-save`，不覆蓋既有
`wog-mvp0-web-save`，讀取時會自動嘗試舊 key；亦可匯入舊 JSON。
舊 Agriculture 存檔會保留存檔時的參數，可從「檔案 → 更新目前世界農業」明確切換；
Original 不會被偷偷改為 Agriculture。

來源版本：`web-mvp-0` commit `390c336417953c97fa108aedf6daf9e93b88f1f6`。
[詳細程式分層](docs/ARCHITECTURE.md) · [UI Guide](docs/UI_GUIDE.md) ·
[農業驗算紀錄](docs/AGRICULTURE_BALANCE.md)。
