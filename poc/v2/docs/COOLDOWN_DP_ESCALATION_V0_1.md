# Cooldown DP Escalation v0.1 — 可強制施放的神蹟冷卻

**狀態：** World of God Web PoC v2 可試玩版（2026-10-12）。
本輪只改 Miracle 冷卻期間的**施法資格與 DP 費用**，不新增 Charm、不修改 Faith Contest 的宗教歸因和改宗規則，也不更動 Oracle 額度。

## 規則

同一位神、同一種 Miracle 的冷卻期間，連續施放的價格如下：

| 本次施放 | 條件 | DP 價格 | 冷卻 |
| --- | --- | --- | --- |
| 第 1 次 | 此技能已就緒 | `baseCost × 1` | 從施放時開始 |
| 第 2 次 | 此技能尚在冷卻 | `baseCost × 2` | 不得縮短原截止時刻 |
| 第 3 次 | 同一冷卻連發期間 | `baseCost × 3` | 不得縮短原截止時刻 |
| 第 N 次 | 同上 | `baseCost × N` | 不得縮短原截止時刻 |

`baseCost` 仍由選定的半徑、強度、持續時間、Mastery 等原本演算法計算。**加倍的是本次施放參數所計算的原價，而不是上一次的成交價格**。

- **成功的每次施放**皆從本次施放時計算自身的 Cooldown，但實際技能的截止時刻取 `max(原截止時刻, 目前模擬時間 + 本次 cooldown)`。在 30 天 Rain 冷卻內追加一發 5 天 Rain，不能藉此讓剩餘冷卻縮短。
- 冷卻完全結束時，該技能的下一次施放回到原價 `1×`，不需支付重置費用。
- 沒有額外的反覆施放上限；**DP 是否足額**、原本物理目標、施法中心、神性臨在等驗證仍必須通過。
- 只有**該神的該項 Miracle**累加次數。Rain 的連發不會增加 Heal 的價錢；玩家 Rain 不會增加 AI Rain 的價錢。兩位神明遵守相同規則。
- 失敗的施放或無效目標不耗 DP、沒有 XP、不能刷新冷卻，也不增加倍率。暫停時冷卻不會因真實時間流逝而減少。
- 在冷卻結束時的下一個模擬 Tick 清除 `cooldownCastCount`；當前 Tick 已達截止時間，也直接採用 `1×` 原價。
- 目前每種 Miracle 使用既有個別 Cooldown、Mastery，以及其相同的長短時長計算。這項機制不是全局 Divine Overcharge buff，也不會直接強化神蹟效果。

## 玩家 UI

Miracle 的預覽費用為這次實際需要的 DP，冷卻中顯示「強制施放（2×／3×…）」、剩餘模擬時間與本次預估 Cooldown。只要當前 DP 足以支付預估費用，玩家仍可進入地圖選點；地圖點擊時用相同權威模擬 API 重新確認位置、價格、DP 和真實作用條件。預估與實際價格可能因遊戲時間或參數更新而改變，兩者不會脫節。

DP 不足則停用施放按鈕。**冷卻中但有足額神力不應變成灰色不可點。** 每種 Miracle 記住先前的施放參數，方便重複發動。

## 實作／存檔

- 核心：`poc/v2/src/sim.js` 的 `miracleCooldownPrice`、`commitMiracleCooldown`、`resetReadyMiracleChains`。
- 價格：`cost = baseCost × costMultiplier`；其中 `costMultiplier = 1`（就緒）或 `cooldownCastCount + 1`（冷卻中）。
- 狀態：各神 `god.skills[type].cooldownCastCount`（每個技能一個；舊存檔沒有這個欄位時，若仍在冷卻，視為已施放一次，所以下一次為 `2×`；若已就緒則仍為 `1×`）。
- 既有 `readyAtHour`、`xp`、`level`、`durationDays` 保存原有意義。
- `poc/v2/config/divine-powers-v0.1.json` 記錄本版固定增量的政策；暫無新的數值滑桿、硬性連發次數上限或額外費用幣種。
- `poc/v2/tests/cooldown-escalation.test.cjs` 與 `miracle-cooldowns.test.cjs`、`miracle-parameters.test.cjs` 驗證 1×→2×→3×、無 DP 拒絕、不同技能／雙神隔離、長短時間防止縮短截止、舊存檔接續、存讀回放與施法 UI。

## 目前範圍以外

這項機制**不解決** 40+ 核心信徒難以改宗的獨立問題，也沒有加入 Charm。Charm 的費用、冷卻、信仰自主抉擇仍在下一輪 Faith Contest 設計處理；其高昂原價在 100 DP 上限下可自然限制強制連發。
