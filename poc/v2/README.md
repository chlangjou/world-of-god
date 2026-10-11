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

「歷史」面板改為獨立的垂直捲動區，最新事件排在最上方；預設保留最近 **200** 筆重大事件（超過後刪除最舊者），不影響整頁無捲動原則。舊版預設 130 筆的存檔載入後會升級上限，但已遭截斷的歷史無法還原。

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
| `config/balance-agriculture-v0.1.json` → `granary` | 各聚落自治糧倉建造的建材、勞力及優先度 |
| `config/balance-default.json` | Original 的唯讀快照；核心預設仍在 `src/sim.js` |
| `docs/` | Architecture、UI Guide、Agriculture 驗算紀錄 |
| `tests/` | 核心回歸、資產分離驗證及 Smoke |
| `tools/` | 跨平台 HTTP server、離線打包、獨立驗算 |

每個聚落可利用當地共享木材、石材與居民勞力自行興建實體糧倉；未完工前，原有公共糧食仍能作為臨時共享儲備領用。[糧倉 PoC 說明](docs/GRANARY.md)。

Religion Propagation v0.1 讓成人信徒在空閒時間傳道、兒童從虔誠家庭逐步形成信仰、鄰近聚落自然交流，並讓 Priest 轉傳 Saint 的 Oracle；宗教狀態可在聚落檢視。[詳細機制](docs/RELIGION_PROPAGATION.md)。

Priest Interaction v0.2 加入 Priest／Saint 專屬地圖顏色、祭司彙整信徒真實祈願的可點選泡泡，以及對無信仰／低 Devotion 異教徒的加強傳道。 [互動與對照說明](docs/PRIEST_INTERACTION.md)。

Miracle / Oracle 下一批擴充已確認為 **Harvest、Heal、Efficiency、Drought、Lightning、Confusion、Blindness、Religion Spread**（七種神蹟、一種神諭）。其中 Efficiency 暫時強化己方信徒的實際行動效率；Confusion 干擾決策與協調；Blindness 影響資源感知與可行行動，三者不可只是相同的生產力倍率。`Food Reserve` 因現階段難以與已存在的 `food.produce`／自治儲糧形成可觀察的玩法差異而暫緩，不列入 UI。[擴充規格與驗收界線](docs/DIVINE_POWERS_EXPANSION_V0_1.md)。此為**已確認待實作範圍**，目前尚未宣稱能在試玩版施放。

正式 Miracle 規格中原稱 **Accelerate** 的能力已改名為 **Ripening（促熟）**：只負責作物提早成熟，與提高產量的 Harvest、提升信徒工作效率的 Efficiency 分開。Ripening 不在這一批，仍待作物生長模型能驗證獨立效果後再實作。

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
