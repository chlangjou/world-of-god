# World of God — Web PoC v2


## Victory Conditions v1 — 全球信仰主導勝利（功能分支，2026-10-23）

分支：`feature/victory-dominance-playable-v0.1`。直接下載
[`World-of-God-Playable.html`](World-of-God-Playable.html) 的 **Download raw file**
並在本機以瀏覽器開啟。這是最新 Web PoC v2 的完整離線單檔，
不需安裝 Node.js、也不要直接雙擊模組版 `index.html`。

- 信仰主導率：全世界**在世**居民，按現有 Devotion 權重 `0/1/2/4/8` 統計；
  無信仰者（0–19）不貢獻。以所有參賽宗教的信仰權重總和為分母，不能直接用人口數。
- 只有目前**唯一第一名**有資格累積勝利進度；兩神門檻分別為
  **55% 10 年、65% 5 年、70% 2 年、90% 1 個月**（360 日/年、30 日/月）。
  四條計時器**同時計算、各自重置**；跌破比例或失去第一名，對應進度歸零。
- 三神的 10 年門檻為 **40%**；其餘檻值按
  `1/N + (1 - 1/N) × 優勢係數` 換算。系統的計分器支援多宗教，
  目前遊玩情境仍只有**玩家與一個 AI 神**。
- 右上「信徒（40+）」下方的**我方信仰百分比**可點開所有宗教權重和四條倒數。
  取得勝利時暫停並顯示**勝負結算**；勾選「繼續遊戲」會沿用原世界、
  原 DP、Miracle 冷卻、Presence、居民與 AI 規則進入**自由沙盒**，
  不會提供無限神力，也不會取消已儲存的第一次結算。
- 原 30 人對決「100 日淨改宗 +3」仍保留作為**教學觀察指標**，
  **不是**新的勝利結算條件。單神世界不進行宗教競賽計時。
- 舊存檔讀取時會以**當前存檔時間**開始新的勝負計時，
  不假設過去已維持優勢；新格式的每條計時器、勝利與自由沙盒選擇均隨存檔保存。
- 調整門檻可修改 `config/victory-dominance-v0.1.json`；
  已經存在的存檔會保留建立當下的勝利規則。改動 Profile 需重新創世。
- 快速驗證使用 **Node.js 22**：`npm run test:fast`、
  `npm run build:standalone`。CI 限時三分鐘；不在 CI 跑長期平衡模擬。

---


這是從 `web-mvp-0` 移入 `main/poc/v2/` 的**獨立模組化 Web 試玩版**。
不改動 `main/docs/` 正式 God–World 規則，也不取代 Godot PoC。

## 宗教觀察、歷史來源與 Heal 瞄準（2026-10-23）

- 上方神意介入區永遠顯示「己方／對手」**有效 Oracle**，不必翻歷史。右側原「聚落」改為「宗教」，比較雙方當前 Oracle、核心信徒（Devotion ≥40）、Priest、Saint、Shrine、Temple 與當地 Presence；仍可選擇聚落查看當地宗教分布。
- 歷史保留事件類型（Miracle／Oracle／Faith／Birth），另由真實記錄的 `godId` 判定陣營：青藍是己方，珊瑚紅是對手，中立／沒有可靠歸因的舊事件維持中性色；舊存檔不會被人工改寫來源。地圖持續型 Miracle 的效果顏色仍代表種類，外圈表示施放者。
- Heal 指向畫面中的受傷居民時，UI 記住居民 ID；即使 16× 模擬期間居民換位置，也會在點擊時採其**當前座標**施放。未選中傷者則仍按所點座標進行範圍治療。命中與神力扣除只使用原有 `castMiracle` 驗證路徑。
- 不變更 8 小時邏輯 tick、傷害／Faith／DP／冷卻參數；較平滑的角色移動渲染可再獨立處理。快速回歸仍受 3 分鐘 CI 上限與 Node.js 22 約束。

---

## Shrine / Temple 實體化試玩（功能分支，2026-10-22）

分支：`feature/shrine-temple-web-poc-v0.1`。請先下載本分支的
[**World-of-God-Playable.html**](World-of-God-Playable.html)，在 GitHub 按
**Download raw file**，雙擊下載的單檔 HTML 即可離線試玩；不要直接雙擊模組版
`index.html`。亦可 `cd poc/v2 && npm start` 後開啟 `http://localhost:8000`。

新世界會啟用 `config/shrine-temple-v0.1.json`（舊存檔不會突然憑空生成建築）。
居民因祈禱/祭司的實際活動建立自然集會點，出席累積後自願使用工作時間與公共或
家戶建材建成 Shrine、Temple。聚落檢視顯示狀態與最近集會次數，地圖標記可點選。
Temple 集會提高近距離見面機會，Priest 只有在現場真實接觸後才促進既有的 Oracle
傳播；已持有可靠跨宗教證據的居民也可能自願跨界參訪，不會直接改宗。
集會本身不增加 Devotion、Divine Power、Divine Presence；Temple Core 互不重疊。

為與前輪設計一致，本試玩版啟用精準 Lightning：命中範圍固定 1 格，可摧毀
物理 Shrine/Temple；仍須通過既有施展中心的 Presence 密度、優勢與神力／冷卻檢查。
這輪**沒有**加入神罰自動信仰加成、敵方主動針對建築的特殊 AI 或完整宗教戰爭。
建築可衰退、維護、重建，是否升級受資源、勞動與集會需求制約。

快速驗證：Node.js **22**，`npm run test:fast`（包含 `tests/shrine-temple.test.cjs`），
以及 `npm run build:standalone`。CI 上限為三分鐘，長期平衡測試不放進 CI。

---

## 宗教爭奪試玩版 v0.1（2026-10-15）

**直接離線試玩：**在 GitHub 找到 [World-of-God-Playable.html](World-of-God-Playable.html)，按 **Download raw file** 後，雙擊下載的 HTML 檔。單檔已內嵌 CSS、遊戲程式及全部 Profile，**不需 Node.js、不需網路，也不要直接雙擊原始 `index.html`**。

此試玩包預設 **30 人宗教對決**：雙方各 15 名 Devotion 60 的核心信徒、自然形成的 Saint/Priest 和可運作的聚落；AI 已發布「存糧」Oracle，暫不更改策略。玩家選 **Oracle → 育兒 → 傳下神諭 → 開始 → 16×**，觀察約 100 個模擬日。目標是原 15 名 AI 信徒中至少 **淨爭取 3 人**；新增信徒起始 20–39，所以大字 40+ 核心數不會立即增加，請看畫面的「淨改宗」進度。居民面板可查「異教信任」和改宗前 Devotion，歷史面板可看可歸因的改宗事件。

頂端「場景」可選 **自然河谷**：保留正常世界創生、三個中立原生聚落、AI 自主行動和未必能短期跨聚落接觸的結果。換場景會重開世界，請先儲存／匯出。離線單檔的普通版本 `npm run build:standalone` 也包含以上兩種玩法，預設進入宗教對決。

**界線：**30 人對決是人工設定初始人口、住屋和雙宗教歸屬的教學情境，不是自然演化證明；玩家需真正選對 Oracle 並讓居民自主工作、交流，系統不會固定塞信徒或無條件改宗。已確認「反覆可信成果可使居民在原 Devotion 40+ 自主改宗」的設計原則，**吸引力數值及 100 日後可能過快的連鎖改宗仍是 PoC 實驗**。本次只提交在 `feature/opponent-difficulty-profiles-v0.3`，沒有改動 `main`。詳見 [試玩交付與已知限制](docs/PLAYABLE_EVIDENCE_V0_1.md)。

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

**Strategy Reversal P0/P1 完成（2026-10-13）：** 使用寫死的 Node.js 四組玩家策略，
先用 90 天校準效能，再對兩張 AI 優勢地圖各執行 4 組 180 天策略對照。
不逐 Tick 呼叫 AI、每場獨立設時限、只輸出結束與少量檢查點；
不同策略能翻轉 **20+ 一般信眾**的早期優勢，但後續隔離測試確認，
**40+ 核心信徒最多只能追至平手，尚未證實穩定宗教勝利**。
這是早期策略敏感度證據，不是整體勝率／晚期翻盤驗證。
[原始 P0/P1 結果](docs/STRATEGY_REVERSAL_P0_P1_2026_10_13.md) ·
[以核心信徒為主的 Miracle／Oracle 隔離測試與結束狀態](docs/STRATEGY_CHANNEL_ABLATION_2026_10_13.md)。
可用 `npm run evaluate:strategy -- --seed dry-stress --strategy development --days 180`
單場重跑，或以 `npm run evaluate:strategy:suite` 在本機逐場執行有硬超時的矩陣。

**Strategy Maturation P1.1（360 天核心信徒觀察）完成（2026-10-13）：**
沿用 P1 模擬核心，在兩張固定地圖各做無干預／單一策略的配對延長測試，
共 4 場、4,320 ticks。180 天原本只達平手或仍落後的玩家策略，
在 240～300 天檢查點開始領先 AI 的 **40+ 核心信徒**，
並在原生村落產生穩定信仰人口；無干預組則仍由 AI 明顯領先。
發展策略能提高 80+ 信徒及神力權重；傳教 Oracle 則優先擴張後逐步鞏固。
這不是「既有強勢宗教的晚期逆轉」證據，也不是勝率推估。
[完整結論與重現指令](docs/STRATEGY_MATURATION_P1_1_2026_10_13.md) ·
[四場精簡結果](reports/strategy-maturation-p1.1-2026-10-13.json)。
使用 `npm run evaluate:strategy -- --days 360 --extended true` 明確開啟延長模式；
未開啟時仍維持 180 天上限。

**Late Comeback P2 — 第 300 天已成形對手宗教反攻驗證（2026-10-13）：**
從完全相同的 Day-300 已存世界切出 3 個 120 天分支（無干預／前線救援傳教／
攻擊干擾傳教），追蹤原本 **20 名 AI 核心信徒**，其中 8 名屬原生村。
結果玩家核心信徒最多 10:29，**原本 20 名 AI 核心無人降到 40 以下或改宗**；
5 次救援神蹟施放成功但無改宗，5 次攻擊神蹟都因 Local Divine Presence
不足失敗。存檔指紋 `778899f9`，各分支經還原驗證。
**這證明所測晚期策略無法翻盤，不代表所有可能策略都失敗。**
[完整機制診斷與重現方式](docs/STRATEGY_LATE_COMEBACK_P2_2026_10_13.md) ·
[3 場精簡數據](reports/strategy-late-comeback-p2-2026-10-13.json)。
測試命令 `npm run evaluate:late -- --prepare reports/.snapshots/p2-day300.json`，
再透過 `--from ... --strategy ...` 分別執行 120 日支線。
分支保存用 JSON 在 `reports/.snapshots/`（Git 忽略，不提交大檔案）。

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
