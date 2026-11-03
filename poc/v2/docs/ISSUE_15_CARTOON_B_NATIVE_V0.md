# Issue #15 — Cartoon B: Native-world 4× / 8× Rendering v0

> **2026-11-03**: 玩家選定 **B · 乾淨 2D 卡通** 作為下一階段優先美術方向。此決策取代 Art Direction Exploration v0 的「三選一待確認」，但**不代表 B 已通過真人實際美術驗收**。這批僅確認 *最小真實遊戲渲染原型*，暫不量產職業 Sprite Sheet。

## 直接試玩

Node.js **24**，沿用 `tools/serve.cjs`，不需 `npm install`：

```sh
git switch codex/issue-15-art-style-exploration-v0
cd poc/v2
npm start
```

- 真正可玩的多檔案 Web：<http://localhost:8000/>
- 以既有自然河谷世界及已建房屋定位 **B 4×**：<http://localhost:8000/cartoon-review.html?zoom=4>
- 同一 Seed 的 **B 8×**：<http://localhost:8000/cartoon-review.html?zoom=8>
- 舊 Pixel-art 基準（可對照）：<http://localhost:8000/village-review.html>
- 先前靜態 A/B/C 風格畫面：<http://localhost:8000/art-exploration.html>，**只供概念方向比較，不是真實遊戲畫面**。

也可直接在遊戲中選「自然河谷 → 村落近景」進入 8×，再按縮小可到 4×。新增「畫風 B · 卡通」按鈕可在**同一世界、同一鏡頭、同一 tick** 切換至舊 Pixel 基準，完全不重新創世。

## 真正渲染的內容

- `assets/cartoon-v0/characters.svg`：獨立載入的原創 512×288 **3 行×8 幀**透明 SVG atlas，每幀64×96，包含不同外觀成人 A、成人 B、兒童；待機、4 個步行幀、工作、祈禱、受傷。動作由 `person.activity`、`mobilityTrace` 插補及 `health` 驅動；不能把只是有圖片當成動作自然已驗收。
- `assets/cartoon-v0/ground.svg`：128×384，草地／土／林／河／石／農田各二種低雜訊變體，僅依 `tile.terrain`、水土相鄰關係顯示河岸；已有 `tile.crop>0.16` 才繪製植株。
- `assets/cartoon-v0/objects.svg`：128×384，完成住屋／森林樹／石塊。只在 `household.home` 或真實 `forest`／`rock` 地格觸發，沒有憑空創造房屋、樹、農田或資源。
- `src/village-cartoon-art.js` 是獨立、顯示專用的 atlas painter，使用 Image `drawImage` 和 smooth scaling，不再沿用 pixel nearest-neighbor。純 hash 以 Seed 與座標決定地表/裝飾變體；居民 ID 的已存在 `Art.identity(p)` 決定穩定的小服飾標記，不吃世界 RNG。
- `src/app.js` 只在相機≥4×、**三份 B 圖集全部載入成功**且切換開啟時呼叫新 painter。若任一圖集失敗，整套環境回退到 Pixel（不會一半卡通一半 Pixel），沒有製作的 Priest、Saint 特殊身分／民兵與長者，沿用既有 `character-art.js`；1× 策略總覽仍沿用原圖示。
- 原本 `P0` 0.1×、跟隨相機、可選取居民、Miracle 瞄準與施法的屏幕座標沒有改變；**不改 `sim.js`、AI／宗教／Devotion 40／Presence／8h tick、資源、礦權、戰爭、Seed、存檔和重播**。

## 人工驗收與工程契約

本輪要檢查：
1. 在正常創世／既有真實存檔，固定同一村落與居民，分別於 4×、8× 比較 B 與 Pixel，**是否第一眼能辨識人與兒童**，而不是放大的 icon。
2. 三位角色的髮型、服裝和體型是否足以區分；同一個人在移動／工作／祈禱之間是否保持穩定外觀與腳底錨點。
3. 房屋／田地／樹／河岸與人物的比例是否舒服，地面大面積呈現是否仍像方格地毯；人多或遮擋時是否仍可追蹤。
4. 若成人 A/B 的雙原型仍過於相似，不擴大量產前先微調輪廓與個體分層。完整 Priest、Saint、老人、民兵 仍**不製作**。

`npm run test:cartoon` 與 Node24 <3 分鐘 CI 驗證原始 SVG source、Canvas drawImage、真實 native-world 的 4×／8× 程式路徑、Pixel 回退、世界狀態不可變、P0 Camera／Miracle 與 Smoke。Chromium 會載入完整 `index.html`、真正的自然村落，擷取兩份 1550×940 截圖，並核對 B 圖集已下載、`cartoonStyleBtn` 已開、Camera 真正到 4×／8×。**CI 通過 ≠ 人工共感／美術驗收通過。**

## 仍未完成

B 在 4×/8× 真實遊戲的玩家審美與持續觀察試玩尚未確認；未測數百人同屏 FPS／長時間動畫成本；SVG atlas 為三種原型，不是全身分層的千人造型庫。繼續優化前先回報實際截圖的主觀結果，尤其是否改善「會動的 icon」問題。此 Draft PR 不 merge `main`，舊 Pixel 與整套 A/B/C 研究成果保留可回退。
