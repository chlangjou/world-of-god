# Issue #14 — P2 最小礦權爭端與閉環

## 已確認基準
- P1.5 分支 `codex/issue-14-quarry-p1-5-human-choices` HEAD `570cfe67aac4df200a788910a7697eb1427cc9dd`，P2 另開 `codex/issue-14-quarry-p2-bounded-dispute`；`main` 不動。
- 180 日 P1.5 自然對照：16 次通行核准、12 石持許可開採、至少 7.5 石持許可收據入庫、18 石安全替代礦到貨；自然抗命與礦戰皆 0。受控契約不冒充自然機率。
- P2 opt-in `mineralRights.territorialEnabled=true`，Web `?mineralRights=3`。既有 `=1` P1、`=2` P1.5 與無 query 預設保持不變。

## 本輪最小實作
1. **許可先驗證可到貨性**：有在世、非民兵／守衛且可從真實家戶沿合法路線到礦場的 gatherer 才核准。許可提高正常採礦規劃吸引力，不額外給人、瞬間送石或新增 God 命令；以實際出礦與人員返回家戶入庫兩套 counter 追蹤收益。
2. **兩次實體到場**：第一次遭真人守衛阻攔產生 `guard-warning`；同村在時窗內再次由真人步行到達並抗命，才有 `challenge-resisted`。缺石或領袖單方面想打，都不直接變戰爭。
3. **自主升級**：需有真人雙方領袖、真正守衛、現役民兵、可行道路，未處於和平/結盟、暫停協商或其他停戰期；以 `escalationChance` 做人類自主決定。也可以選擇撤回，不硬寫每次抗命都要打。
4. **有限有結局**：原有民兵沿真實路線行軍，沿用現有 3 回合健康消耗、Healing、玩家交戰暫停；中途達成外交和平或超過 `maxDisputeDays` 就撤軍。最終可能守住、停戰或因訪客真人勝利而轉移礦權。
5. **轉讓不等於立即排他**：原守衛沿家戶路徑撤回，新方只是接下礦權主張，仍要真人行軍派守衛到礦點才能排他；不再把舊版一次性 1.5 石材戰利品當作領土戰成果。保存讀檔重播與礦存守恆照舊。

## 分開驗證
- 受控快速測試 `npm run test:quarry-p2`：在自然生成世界實際居民兩次步行到場，測試只控制其挑戰決策與外交狀態，將升級機率固定 1 以驗證戰鬥與停戰出口；**不得視為自然礦戰率**。
- 三 Seed 自然 A/B 手動 runner：`node tools/quarry-p2-experiment.cjs --days=180`，30/60/120/180 日快照、每日 world validate、JSON restore、額外 24 小時決定性重播。亦可 `--seed=valley-spring-01 --days=30`。
- GitHub CI 使用 Node 24，單 job 上限 3 分鐘，含快速測試／舊回歸／smoke／offline playable 同步；最多只執行單 Seed 30 日自然診斷。不能把 CI 30 日當全量 180 日結果。
- 核心 Devotion >=40、原改宗規則、Miracle Presence、God 不能指揮軍隊與天然礦實存不改。

## 未聲稱完成
自然 180 日礦戰仍可能是零。許可時有可達成人只代表潛在可用，實際收益仍以家戶到貨收據計算；不增加 Stone Genesis、帝國、新兵種或大規模戰役。
