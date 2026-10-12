# World of God — Web PoC v2

這是從 `web-mvp-0` 移入 `main/poc/v2/` 的**獨立模組化 Web 試玩版**。
不改動 `main/docs/` 正式 God–World 規則，也不取代 Godot PoC。

## 快速啟動

需要 Node.js 18 以上，無外部套件，**不用 npm install**：

```sh
cd poc/v2
npm start
```

開啟 **http://localhost:8000/**。新世界預設 Agriculture v0.1、三座已有人口的
**原生村落**，以及位於不同區域的 AI 神。可關閉 AI（新世界仍有原住民），
或選 Original 做 A/B。因為 JSON Profile 由瀏覽器 `fetch` 載入，
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
| `config/opponent-v0.1.json` | 歷史混居型對手 Profile（供舊存檔與既有測試相容） |
| `config/opponent-v0.2.json` | **新世界預設**的兩神分隔起始地、原生村數量及對手策略 |
| `config/balance-agriculture-v0.1.json` → `nativeResilience` | 遠離水源的原生村初始存糧和自主儲糧天數目標 |
| `config/balance-agriculture-v0.1.json` → `granary` | 各聚落自治糧倉建造的建材、勞力及優先度 |
| `config/balance-default.json` | Original 的唯讀快照；核心預設仍在 `src/sim.js` |
| `docs/` | Architecture、UI Guide、Agriculture 驗算紀錄 |
| `tests/` | 核心回歸、資產分離驗證及 Smoke |
| `tools/` | 跨平台 HTTP server、離線打包、獨立驗算 |

每個聚落可利用當地共享木材、石材與居民勞力自行興建實體糧倉；未完工前，原有公共糧食仍能作為臨時共享儲備領用。[糧倉 PoC 說明](docs/GRANARY.md)。

Religion Propagation v0.1 讓成人信徒在空閒時間傳道、兒童從虔誠家庭逐步形成信仰、鄰近聚落自然交流，並讓 Priest 轉傳 Saint 的 Oracle；宗教狀態可在聚落檢視。[詳細機制](docs/RELIGION_PROPAGATION.md)。

Opponent v0.1 **已導入單一 AI 神（暮影信仰）**：新世界預設開啟，與玩家共用真實人口、聚落、農地及農業運算，但雙方各自擁有神力、技能／冷卻、Saint、Priest、Oracle；AI 會自主傳教、發佈神諭、施展支援型神蹟，條件允許時嘗試干擾對方 Priest。居民在 40 以上不因一般傳教而動搖，低於 40 才能逐步失信，低於 20 才可能改宗。頂端可切換「對手 AI 神／無對手」，切換會重新創世；**讀取舊存檔不會強制新增 AI**。地圖珊瑚色標記為對手居民，聚落面板顯示雙宗教人數。 [機制、參數與驗證](docs/OPPONENT_V0_1.md)。

**World Genesis / Opponent v0.2 已實作：** 玩家與 AI 神分別從河谷不同位置開始，
彼此不在出生時爭奪同一群家戶；三座原生村原本就有居民、住屋、農田及既有存糧，
初始未歸屬任何神明。選址不再採固定座標，而是檢查距離、水源與資源，
讓玩家／AI 一側各有一座機會相近的原生村，中央村則接近雙方等距。
遠河聚落會自主提高儲糧目標，而非憑空在運作時生成食物。
快進中出現玩家信徒的祈禱會切回 **1×** 並定位；
AI 神蹟傷害或有效動搖玩家信眾會**暫停**並標出受影響位置。
這些中斷只影響瀏覽器播放，不改寫模擬時間及運算規則。
[世界創生、事件中斷與可調參數](docs/WORLD_GENESIS_NATIVE_V0_2.md)。
v0.1 的原始混居模式仍可經舊存檔讀取，不會強制遷移原有人口。

**Religion Competition v0.3 已接上 Miracle → Faith：** 
Heal 必須真正恢復健康，Efficiency 需在祝福後確實完成有產出的工作；
受益者信仰變動中大幅度，附近見證者較小幅度。Rain 必須對應當地真實祈求且改善
水分與收成；Ripening／Harvest 只有實際作物改善後才給附近小幅見證回饋。
40+ 信徒仍不受普通傳教動搖，但可以因可信的異教神蹟而產生懷疑，
不會施法瞬間強制改宗。未入教居民有短期神蹟印象，
由每週自主宗教決策決定是否接受信仰。
修正兩位神明的傳教神諭加成被過早清除的問題，並加入 AI 對等祈願履行歸因；
居民詳情可查看最近的信仰證據與神蹟印象。
[可調數值與完整規則](docs/RELIGION_COMPETITION_V0_3.md)。

**Opponent Difficulty v0.3（可切換難度）：** 選擇 **輕鬆／標準／原版 AI**。
先前的完整 AI 決策模式現在是最高的「原版 AI」，**沒有再加快或賦予全地圖最佳化**；
新世界預設的「標準」則讓 AI 有較長的決策間隔，留出玩家查看祈禱、切換介面、
選擇神蹟中心的時間。三個難度使用完全相同的世界規則、人口、DP、宗教門檻與施法成本。
難度可在遊戲進行中切換而不重開世界；既有存檔若沒有難度資料，會保留原先完整 AI。
請留意這是**決策頻率／操作壓力分級**，不保證每張 Seed 都有對應的勝率。
[詳細難度規則與驗證](docs/OPPONENT_DIFFICULTY_V0_3.md)。

**地圖與勝負敏感度診斷：** 同一張地圖交換雙方出生位置、傳教 RNG 或初始虔誠度，都可能翻轉宗教競爭結果。60 次休閒玩家代理模擬顯示，遊戲速度及早期原生村的歸屬影響很大；當多數村民已確立 40+ 信仰時，後期追趕能力不足。[地圖路徑依賴與隨興玩家控制實驗](docs/MAP_PATH_DEPENDENCE_EVALUATION_2026_10_12.md)。

Priest Interaction v0.2 加入 Priest／Saint 專屬地圖顏色、祭司彙整信徒真實祈願的可點選泡泡，以及對無信仰／低 Devotion 異教徒的加強傳道。 [互動與對照說明](docs/PRIEST_INTERACTION.md)。

**需求定位**：需求分頁現在顯示祈求的來源聚落與座標，每頁可點選三筆，更多需求使用上一頁／下一頁。選取後地圖顯示十字中心，缺雨類另外顯示實際農田評估的 11 格參考圈。Priest 祈求泡泡與切換祈願也能定位；需求結束時標記自動清除。定位不會施放 Miracle 或消耗 DP。舊存檔的創始河谷缺雨祈求會使用當時原有的創始區域中心。

Miracle / Oracle 擴充 v0.1 **已實作** **Ripening、Harvest、Heal、Efficiency、Drought、Lightning、Confusion、Blindness、Religion Spread**（八種新增神蹟、一種新增神諭），保留原有 Rain 與 Food Production。其中 **Ripening（促熟）優先於 Harvest（豐收）**：現有 Agriculture 的作物存量 `cropStock` 容易被收割清空，促熟直接加快現有作物的生長／補充速度，不增加成熟作物的存量上限。豐收必須展示不同的單次收成效果，若做不到真正差異則單獨暫緩。Efficiency 暫時強化己方信徒的實際行動效率；Confusion 干擾決策與協調；Blindness 影響資源感知與可行行動，三者不可只是相同的生產力倍率。`Food Reserve` 因現階段難以與已存在的 `food.produce`／自治儲糧形成可觀察的玩法差異而暫緩，不列入 UI。[擴充規格與驗收界線](docs/DIVINE_POWERS_EXPANSION_V0_1.md)。能力已接上遊戲地圖施展／Saint 發佈、模擬狀態與保存恢復；數值仍是 PoC 初始值。實際視窗尺寸及遊戲手感仍須由本機瀏覽器試玩確認。

正式 Miracle 規格中原稱 **Accelerate** 的能力已改名為 **Ripening（促熟）**：負責作物提早成熟／現有農田更快補充可收割作物，與提高單次實際收成的 Harvest、提升信徒工作效率的 Efficiency 分開。**Ripening 已列第一批並完成實作**：直接強化現有連續式作物存量的補充過程，毋須新增複雜的離散成熟階段。這輪不進行額外 A/B 平衡試驗。

正式規格： [Core Principles](../../docs/CORE_PRINCIPLES.md)、
[Population](../../docs/POPULATION_MODEL.md)、
[Settlement Economy](../../docs/SETTLEMENT_ECONOMY_OCCUPATIONS.md)。

**Cooldown DP Escalation v0.1 已實作：** 每種 Miracle 各有自己的冷卻連發次數。
首次施放 1× DP，冷卻中仍可用 **2×、3×、4×…** DP 強制施放；
DP 不足才禁止，而不是冷卻中一律灰色停用。每次施放重新計算冷卻，
**新時限不得縮短舊時限**；該技能完全冷卻後下一發恢復 1×。
AI 與玩家共享費率，各 Miracle 不互相影響，已存遊戲的冷卻可直接沿用。
UI 顯示本次倍率、所需 DP 及剩餘模擬時間。
[施放與存檔規則](docs/COOLDOWN_DP_ESCALATION_V0_1.md)。

## 基本檢查

基本操作：選 **Miracle** 後挑選能力，調整範圍、強度及（持續型能力的）天數，再按「選擇施展位置」並點地圖。**每種 Miracle 都會各自記住最後設定的範圍／強度／持續天數**，切換後返回自動恢復；切換 Miracle／Oracle 也會記住各自最後選的能力，方便連續施展。這是本頁面內的 UI 操作記憶，不會修改遊戲規則與世界存檔。選 **Oracle → 傳教**，指定 Saint 後發佈；自然 Priest 傳教不需 Oracle 仍持續進行。受影響居民可在地圖標記及居民檢視看到限時狀態。按 Esc 取消選點。每項神蹟有自己的 Cooldown。**持續型神蹟的冷卻依施展時間、範圍、強度與 Mastery 計算**，例如同範圍的 5 天降雨會比 30 天降雨更早冷卻；介面會在施放前顯示本次預計冷卻天數。

```sh
npm test
npm run smoke
npm run check:agriculture
npm run build:standalone  # 可選，dist/ 不入庫
```

測試包括新增原生村公平性、地理水源風險、自主儲糧、延長旱季生存和 deterministic replay；對手神的獨立神力、冷卻、宗教角色、傳教、神諭、神蹟和 deterministic replay；以及 8 種新增 Miracle 與 Religion Spread 的直接功能檢查，並保留 4,000 日農業、土地資源守恆、自主成家、多聚落、宗教家庭傳承、傳道、Oracle 接力與可重現性的既有回歸；
已加入「三筆需求定位／翻頁／Priest 定位／自動清除」直接互動測試；仍需實際瀏覽器檢查 1280×720／1366×768／1920×1080 佈局。

## 存檔

v2 採用獨立的瀏覽器 key `wog-poc-v2-save`，不覆蓋既有
`wog-mvp0-web-save`，讀取時會自動嘗試舊 key；亦可匯入舊 JSON。
舊 Agriculture 存檔會保留存檔時的參數，可從「檔案 → 更新目前世界農業」明確切換；
Original 不會被偷偷改為 Agriculture。

來源版本：`web-mvp-0` commit `390c336417953c97fa108aedf6daf9e93b88f1f6`。
[詳細程式分層](docs/ARCHITECTURE.md) · [UI Guide](docs/UI_GUIDE.md) ·
[農業驗算紀錄](docs/AGRICULTURE_BALANCE.md)。
