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
| `config/divine-powers-v0.1.json` | 8 種新增神蹟的 DP／冷卻／強度／持續期及傳教反應參數 |
| `config/opponent-v0.1.json` | 單一 AI 對手神的初始信徒、神力、決策間隔及傳教神諭參數 |
| `config/balance-agriculture-v0.1.json` → `granary` | 各聚落自治糧倉建造的建材、勞力及優先度 |
| `config/balance-default.json` | Original 的唯讀快照；核心預設仍在 `src/sim.js` |
| `docs/` | Architecture、UI Guide、Agriculture 驗算紀錄 |
| `tests/` | 核心回歸、資產分離驗證及 Smoke |
| `tools/` | 跨平台 HTTP server、離線打包、獨立驗算 |

每個聚落可利用當地共享木材、石材與居民勞力自行興建實體糧倉；未完工前，原有公共糧食仍能作為臨時共享儲備領用。[糧倉 PoC 說明](docs/GRANARY.md)。

Religion Propagation v0.1 讓成人信徒在空閒時間傳道、兒童從虔誠家庭逐步形成信仰、鄰近聚落自然交流，並讓 Priest 轉傳 Saint 的 Oracle；宗教狀態可在聚落檢視。[詳細機制](docs/RELIGION_PROPAGATION.md)。

Opponent v0.1 **已導入單一 AI 神（暮影信仰）**：新世界預設開啟，與玩家共用真實人口、聚落、農地及農業運算，但雙方各自擁有神力、技能／冷卻、Saint、Priest、Oracle；AI 會自主傳教、發佈神諭、施展支援型神蹟，條件允許時嘗試干擾對方 Priest。居民在 40 以上不因一般傳教而動搖，低於 40 才能逐步失信，低於 20 才可能改宗。頂端可切換「對手 AI 神／無對手」，切換會重新創世；**讀取舊存檔不會強制新增 AI**。地圖珊瑚色標記為對手居民，聚落面板顯示雙宗教人數。 [機制、參數與驗證](docs/OPPONENT_V0_1.md)。

Priest Interaction v0.2 加入 Priest／Saint 專屬地圖顏色、祭司彙整信徒真實祈願的可點選泡泡，以及對無信仰／低 Devotion 異教徒的加強傳道。 [互動與對照說明](docs/PRIEST_INTERACTION.md)。

**需求定位**：需求分頁現在顯示祈求的來源聚落與座標，每頁可點選三筆，更多需求使用上一頁／下一頁。選取後地圖顯示十字中心，缺雨類另外顯示實際農田評估的 11 格參考圈。Priest 祈求泡泡與切換祈願也能定位；需求結束時標記自動清除。定位不會施放 Miracle 或消耗 DP。舊存檔的創始河谷缺雨祈求會使用當時原有的創始區域中心。

Miracle / Oracle 擴充 v0.1 **已實作** **Ripening、Harvest、Heal、Efficiency、Drought、Lightning、Confusion、Blindness、Religion Spread**（八種新增神蹟、一種新增神諭），保留原有 Rain 與 Food Production。其中 **Ripening（促熟）優先於 Harvest（豐收）**：現有 Agriculture 的作物存量 `cropStock` 容易被收割清空，促熟直接加快現有作物的生長／補充速度，不增加成熟作物的存量上限。豐收必須展示不同的單次收成效果，若做不到真正差異則單獨暫緩。Efficiency 暫時強化己方信徒的實際行動效率；Confusion 干擾決策與協調；Blindness 影響資源感知與可行行動，三者不可只是相同的生產力倍率。`Food Reserve` 因現階段難以與已存在的 `food.produce`／自治儲糧形成可觀察的玩法差異而暫緩，不列入 UI。[擴充規格與驗收界線](docs/DIVINE_POWERS_EXPANSION_V0_1.md)。能力已接上遊戲地圖施展／Saint 發佈、模擬狀態與保存恢復；數值仍是 PoC 初始值。實際視窗尺寸及遊戲手感仍須由本機瀏覽器試玩確認。

正式 Miracle 規格中原稱 **Accelerate** 的能力已改名為 **Ripening（促熟）**：負責作物提早成熟／現有農田更快補充可收割作物，與提高單次實際收成的 Harvest、提升信徒工作效率的 Efficiency 分開。**Ripening 已列第一批並完成實作**：直接強化現有連續式作物存量的補充過程，毋須新增複雜的離散成熟階段。這輪不進行額外 A/B 平衡試驗。

正式規格： [Core Principles](../../docs/CORE_PRINCIPLES.md)、
[Population](../../docs/POPULATION_MODEL.md)、
[Settlement Economy](../../docs/SETTLEMENT_ECONOMY_OCCUPATIONS.md)。

## 基本檢查

基本操作：選 **Miracle** 後挑選能力，調整範圍、強度及（持續型能力的）天數，再按「選擇施展位置」並點地圖。**每種 Miracle 都會各自記住最後設定的範圍／強度／持續天數**，切換後返回自動恢復；切換 Miracle／Oracle 也會記住各自最後選的能力，方便連續施展。這是本頁面內的 UI 操作記憶，不會修改遊戲規則與世界存檔。選 **Oracle → 傳教**，指定 Saint 後發佈；自然 Priest 傳教不需 Oracle 仍持續進行。受影響居民可在地圖標記及居民檢視看到限時狀態。按 Esc 取消選點。每項神蹟有自己的 Cooldown。**持續型神蹟的冷卻依施展時間、範圍、強度與 Mastery 計算**，例如同範圍的 5 天降雨會比 30 天降雨更早冷卻；介面會在施放前顯示本次預計冷卻天數。

```sh
npm test
npm run smoke
npm run check:agriculture
npm run build:standalone  # 可選，dist/ 不入庫
```

測試包括對手神的獨立神力、冷卻、宗教角色、傳教、神諭、神蹟和 deterministic replay；以及 8 種新增 Miracle 與 Religion Spread 的直接功能檢查，並保留 4,000 日農業、土地資源守恆、自主成家、多聚落、宗教家庭傳承、傳道、Oracle 接力與可重現性的既有回歸；
已加入「三筆需求定位／翻頁／Priest 定位／自動清除」直接互動測試；仍需實際瀏覽器檢查 1280×720／1366×768／1920×1080 佈局。

## 存檔

v2 採用獨立的瀏覽器 key `wog-poc-v2-save`，不覆蓋既有
`wog-mvp0-web-save`，讀取時會自動嘗試舊 key；亦可匯入舊 JSON。
舊 Agriculture 存檔會保留存檔時的參數，可從「檔案 → 更新目前世界農業」明確切換；
Original 不會被偷偷改為 Agriculture。

來源版本：`web-mvp-0` commit `390c336417953c97fa108aedf6daf9e93b88f1f6`。
[詳細程式分層](docs/ARCHITECTURE.md) · [UI Guide](docs/UI_GUIDE.md) ·
[農業驗算紀錄](docs/AGRICULTURE_BALANCE.md)。
