# Godot MVP-0 核心機制 PoC 交接

日期：2026-10-10（Asia/Taipei）。實作依據：[FIRST_PLAYABLE_IMPLEMENTATION.md](FIRST_PLAYABLE_IMPLEMENTATION.md)，並已讀取使用者指定的 [GitHub main 版本](https://github.com/chlangjou/world-of-god/blob/main/docs/FIRST_PLAYABLE_IMPLEMENTATION.md)。原設計契約未修改。

目前是可以操作與驗證的 S0–S3 slice；不是完整 Sandbox v1。內容限於規格中的河谷預設、Rain、`food.produce` 和驗證它們所需的模擬／觀察功能。

## 啟動

在專案根目錄雙擊 `Play.cmd`。開發時雙擊 `Open-Editor.cmd`，或用 Godot 匯入 `godot/project.godot` 後按 F5。

本機已備妥官方 Godot **4.7.2.stable.official.ed1daf0bf**，位於 `.tools/godot/`。這個目錄不提交 Git；新 checkout 可執行 `./tools/install-godot.ps1`。也可傳入既有 Godot 路徑：

```powershell
./tools/godot.ps1 -Mode play -GodotPath 'C:/path/to/Godot_console.exe'
```

Windows 啟動腳本把 Godot 的資料目錄放在專案 `.tools/userdata/`，編輯器使用 self-contained 模式。字體使用系統的 Microsoft JhengHei／Noto Sans TC，未加入外部美術或字體資產。

## 5–10 分鐘人工驗證步驟（M 尚待人工驗收）

1. 使用預設 Seed **1106**，先保持 1×。初始有 32 位真實居民、8 戶家庭、0 個已建立聚落。觀察家庭活動、糧食祈求與自主形成聚落。1 個模擬天約 8 秒。
2. 約第 3 個模擬天會出現可接收神諭的聖者。祭司是另一種職務，不因任職就能接收神諭。
3. 在「降雨」分頁選快速設定；中心預設 `(24, 26)`，半徑 9、強度 1、持續 12 天。可點地圖調整中心。查看 DP、臨在與冷卻預覽後按「施放降雨」。初始標準施放成本 24 DP、冷卻 30 個模擬天。
4. 切換「神諭」，向選定聖者傳達 `food.produce`。不指定居民職業、行動或產量。查看收到、聽見、接受／暫緩、嘗試與產出階段。
5. 切換地圖到「土壤濕度」與「未收穫作物」，點選居民或右側居民選單，查看工作評分、神諭壓力、可行資源、決策理由，以及家庭／共用庫存的差異。
6. 讓時間繼續，觀察實際收穫與祈求改善。只有可信且真正改善的需求才增加持久虔誠；強度跨越貢獻級距後，後續 DP 恢復率提高。點選世界紀錄的事件連結查看直接父事件與實際採用的理由。
7. 測試重複神諭、降雨冷卻、暫停、加速及存讀檔。拒絕理由應可理解。神諭普通成功不會自動結束，需到期、聖者死亡或按「宣告此神諭結束」。

這是觀察流程，沒有自動施放、腳本保證豐收或強迫居民執行。需求可能自行解決，神諭也可能延後住房等其他工作。人工需評估是否能理解這些取捨；機器操作檢查不能代替 M。

## 已實作的狀態與權責

| 模組 | 權責 |
| --- | --- |
| `world.gd` | 64×64 河谷、土壤／河流距離、自然天氣、水分、作物與可採資源；降雨只注入水分 |
| `individuals.gd` | 真實 ID、生命／飢餓／年齡、能力、生計與當前行動；比較可行工作及 Calling 後自行選擇；輕量配對、孕期與死亡 |
| `households.gd` | 成員／照護、自有庫存、消費／不足、居住與地方搬遷；向共用儲備請求缺口 |
| `settlements.gd` | 聚落形成、共用庫存、基礎工作需求、材料與勞動建造／維護；Trade Demand 接點目前為 0 |
| `religion.gd` | 聖者／祭司、直接祈求、獨立配額／神諭生命週期、地方傳播、Calling 與可信需求歸因 |
| `divine.gd` | 神的全域 DP、弱自然恢復、中心臨在驗證、Rain 成本／冷卻／獨立熟練度 |
| `session.gd` | 整數秒時鐘、固定次序排程、種子 RNG、命令 API、唯讀副本、版本化存讀檔與效能計時 |
| `history.gd` | 最近 240 筆重要事件；舊事件附加寫入磁碟接點 |

呈現層讀取副本，透過命令 API 施放神意；人物標記不是人口的權威來源。暫定平衡值在 `godot/data/rules.json` 與 `river_valley.json`。

時鐘採 30 天／月、360 天／年；環境每 6 小時、個人每 4 小時、經濟與宗教每日、人口機會每月更新。出生、降雨結束、神諭結束與配額補充在精確的到期秒處理。成人粗略採 8 小時休息、8 小時工作、8 小時家庭／交流。

存檔格式 1、規則版本 **mvp0-2**，保存 RNG 精確整數狀態、時間、排程、人口／家庭／庫存、雨、DP／熟練度／冷卻、聖者配額／神諭與熱事件。`mvp0-1` 開發中存檔會拒絕載入。畫面暫停／倍速屬於目前觀察設定；不使存檔中的世界跨越額外時間。

透過啟動腳本的存檔與冷紀錄位於 `.tools/userdata/Godot/app_userdata/World of God · 河谷初聲/`：`river_valley.wog`、`history.jsonl`、`commands.jsonl`。熱命令清單也限 240 筆。完整歷史查詢／世界分支整理仍在 #10 的後續範圍內。

## 已執行的驗證

```powershell
./tools/godot.ps1 -Mode test
./tools/godot.ps1 -Mode capture
./tools/godot.ps1 -Mode benchmark
```

此外執行 Godot headless editor import，檢查專案可匯入；並以 Windows PowerShell 5 執行啟動腳本的 headless 短跑，確認 `.cmd` 所使用的執行環境可啟動。

核心 runner：**64 checks, 0 failures，退出碼 0**。畫面 runner：**6 checks, 0 failures，退出碼 0**，使用真實 OpenGL 呈現器並檢視輸出截圖。腳本同時檢查 Godot log 的 runtime／compile error，使錯誤不會被 Godot 的一般退出碼掩蓋。

| 規格 gate | 證據 |
| --- | --- |
| A／B | 90 模擬天無玩家命令，居民生存與真實活動，自主形成聚落 |
| C | Food／Wood／Stone／Fiber 初始＋產出－消費／材料投入＝實際庫存；可配置新產出分配；缺糧先產生壓力 |
| D | 受控近到期孕期建立真實新生兒；高齡死亡；家庭搬遷保存成員關係 |
| E | 消耗正確 DP、拒絕不扣費、中心限定臨在、雨的水分／生長／勞動收穫、冷卻與自動到期、無回滾、過濕可能降低生長 |
| F | 40 信徒邊界、0:1:2:4:8 權重、可信需求改善及單次持久回饋、自然 DP 不產生臨在／信徒／熟練度 |
| G | 聖者與祭司差異、配額與同類型鎖、不同聖者獨立、-1 結束下限、補充／到期／死亡／接收者延續；成功不自動結束 |
| H | 相同 Seed／狀態的對照中，至少 1 位居民因 Calling 改變可行工作；無資源 fixture 無食物產出；遠方信徒沒有全域廣播 |
| I／J | 暫停、1×／4×／16×、分段與大步快進一致；時間戳命令重播、精確存檔與續跑、呈現副本隔離、熱事件與命令有界 |
| K | 同一 `Session` 的 headless runner；測試失敗或腳本錯誤回傳非 0 |
| L | 32 人 90 天，以及 1,000／10,000 人各 3 天的獨立 headless 探測，保存各系統計時、記憶體與實際到期 backlog |
| M | **尚待人工體驗驗收**；UI 檢查與截圖不是人工產品驗收 |

可重播的具體結果與效能數據保存於 [evidence](evidence/mvp0-acceptance.json)／[benchmark](evidence/mvp0-benchmark.json)。截圖為 [實際執行畫面](evidence/mvp0-ui.png)，由 UI 測試下達正常命令後擷取，沒有預製劇情。

## 效能數據的解讀

本次最終單獨執行的 Windows headless 結果（Godot 4.7.2、Seed 1106、規則 mvp0-2）：

| 人口 | 模擬天數 | 耗時（秒） | 模擬天／實際秒 | 追蹤記憶體（MiB） | 到期 backlog |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 32 | 90 | 9.182 | 9.802 | 30.25 | 0 |
| 1,000 | 3 | 2.007 | 1.495 | 37.64 | 0 |
| 10,000 | 3 | 18.310 | 0.164 | 103.43 | 0 |

32 人探測的環境 dispatch 約 6.909 秒、個人決策約 2.174 秒；10,000 人探測的個人決策約 17.044 秒。尚未加入大人口優化。完整各系統計時見 JSON 證據。

每次執行會重產生 `godot/test-output/acceptance.json`、`benchmark.json` 與 `ui-preview.png`，該目錄不提交 Git。交接的 `docs/evidence/` 保存本次結果。

系統計時以 `Time.get_ticks_usec()` 包住模擬 dispatch，為單執行緒區段耗時的 CPU 工作近似值，未包括初始化、所有排程／精確期限檢查、呈現副本與渲染。記憶體是 `OS.get_static_memory_usage()` 的 Godot allocator 追蹤值，並非 Windows 整個程序的 working set。大人口是探索性密集配置，只跑三天，不能推論長期或 10k 即時遊戲效能。

## 實作提交與限制

- `eeed011`：可 headless 執行的 Godot Simulation Kernel、分模組狀態與初步 90 天 smoke。
- `8c0b2d7`：可操作的 S0–S3、核心規則穩定化、64 項驗證、畫面檢查與效能 runner。

只有本機提交，沒有推送、建立 PR 或宣告 Issue #11 完成。人工 M 未驗收，因此沒有更改原規格的勾選狀態。

數值未做完整平衡；地形／移動、人口配對與死亡都採輕量模型。長年世界與大人口畫面尚未驗證。正式美術、其他神蹟、競爭宗教、高階權限與 eligibility hold、Radius 神諭、完整歷史圖等維持規格排除範圍。
