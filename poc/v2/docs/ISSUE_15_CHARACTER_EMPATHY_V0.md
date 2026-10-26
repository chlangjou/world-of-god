# Issue #15 — Character Readability / Empathy v0
2026-10-26 · 以正常遊戲可辨識的個體為目標，而非增加更細的模擬

## 已核實玩家阻礙
經過 Living World 的 Camera 縮放、連續移動、群聚錯位、年齡尺寸穩定修復後，實際近景仍像「會動的 icon」。人物幾乎相同：原圓頭＋方塊身體沒有明顯髮型、服裝、職業、年齡、身形輪廓，也難在幾天後憑視覺記住同一個人。

## 本輪實作及必要界線
- 新 `src/character-art.js`：只在近景 >=3.5× 改用 3/4-view、可獨立替換成真正 sprite sheet 的分層 Canvas character painter；1×–2× 仍用舊全圖 icon 以保性能和資訊可讀性。
- 角色可辨識的六種模板：成人外套、成人不同服裝／髮型、兒童短身與背袋、長者白髮和手杖、祭司兜帽長袍與法杖、民兵頭盔甲冑與盾牌。Saint 星徽、領袖冠飾為可見的追加層。成人 A/B 屬**美術原型變化，不以性別角色欄位推定玩家性別**。
- 每個活著的個體由 `person.id` 的穩定純 hash 產生膚色、髮色、髮型、服裝和額外配件，不用 `Math.random` 或 `s.rng`，不會重設時讓同一人物換造型。**使用視覺外觀不寫入人物或世界存檔，不創造人格、情緒、社會決策。**
- Pose 完全依當下真實 `activity`、`health`、`hunger`、`campInjury`、已實際發生的 Heal 回復，以及真實 Priest／Saint／Militia／Leader 身分。工作工具／祈禱手勢／走路擺動／受傷繃帶與彎身等是有條件的視覺表演，不增加收益、接觸、傳教或心理數值。
- 舊 `src/living-world.js` Character Layout、Stable Size、點擊、群聚名單、Camera 跟隨、Heal/Lightning 的真實命中與 8 小時 tick 完全沿用；`sim.js`、`politics.js`、`mobility.js`、配置與保存重播 **全部不動**。
- 同步 `World-of-God-Playable.html`，新增 `character-gallery.html` 展示六種原型可切換活動姿態，一頁比對放大畫法與遊戲中 8× 近景比例。Gallery 是刻意合成的美術檢視資料，**不是**正常世界測試或已證明玩家共感增加。

## 怎麼試玩
1. 先執行 `cd poc/v2 && npm start`，打開 `/character-gallery.html`；比較六種輪廓、姿態和小尺寸辨識。這頁不會更改遊戲存檔。
2. 開 `/index.html` 或最新單檔 `World-of-God-Playable.html`，選自然河谷／載入真實中盤舊存檔；在 1× 看世界，4×–8× 放大村落並跟隨一位真人。
3. 觀察同一人跨工作／祈禱／行走是否有穩定個人辨識。見到真人受傷才施放 Heal，注意實際健康上升與可證實的後續生活行為；不能用控制場景假定所有人都會受傷或必須改宗。

## 最小驗收與後續
- 3–5 位未看規格的新玩家，各 10–15 分鐘。先看近景角色，不讀面板辨識兒童／長者／祭司／民兵；選出自己願意跟隨的真人並描述「為什麼這個人值得觀察」；在自然事件中看懂 Miracle 對真人的影響。
- 若仍覺得是圖示，不先增加 AI 情緒數值；檢討輪廓、美術風格、角色體型和動畫比例。若這套可讀但美術太簡陋，下一批再以真正手繪 / pixel-art sprite sheet 替換同一個角色 painter 模組。
- CI Node.js 24，單 Job ≤3 分鐘；新繪圖／身份穩定／狀態契約、群聚和 Heal、既有 Layer／Battle／Layout、Smoke 與離線 parity。工程通過不等於真人驗收通過。
- 分支 `codex/issue-15-character-empathy-v0` 承接已驗證 `0b4da52`，保持 `main` 不動、不自行 merge，PR 先標 Draft。
