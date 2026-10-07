# Tracefold｜網路請求分析工作台

把瀏覽器匯出的 HAR 檔案變成可篩選的請求時間軸。用來回答三個具體問題：哪個請求最慢、哪個資源最大、哪些請求失敗。

[直接操作](https://miiduoa.github.io/tracefold/) · [原始碼與執行方式](../README.md) · [設計取捨](design.md)

## 操作路徑

1. 開啟工作台，先用標示為 synthetic 的 24 筆範例。
2. 選「Failed requests」，點開 503 請求查看時間分解。
3. 改成「Slowest first」，比較等待伺服器回應與接收資料的時間。
4. 匯入自己的 HAR；資料在瀏覽器記憶體處理。
5. 匯出摘要。摘要不保留 headers、cookie、body 與 query string，但 hostname、path 仍需自行檢查。

## 可以檢查的技術內容

- TypeScript 資料驗證與錯誤定位：錯誤 entry 不會被悄悄略過。
- Sweep-line 計算尖峰併發，同時間的結束事件先於開始事件處理。
- p95 使用 nearest rank；未知值與 0 分開處理。
- HAR 的 TLS 時間已包含於 connect，不重複加總。
- 載入序號避免較早的非同步匯入覆蓋較新的選擇。
- DOM 輸出 escape、無外部執行腳本、無持久化資料儲存。

## 驗證與限制

`npm test` 執行 18 項核心測試；`npm run build` 檢查型別並建置。介面另外在 Chromium 檢查檔案匯入、錯誤匯入、篩選、排序、下載及手機寬度。

目前不分析 LCP、CLS 或真正的 critical path。只有網路紀錄，不能宣稱已找到整個頁面的效能瓶頸。所有範例是合成資料，沒有假裝成真實客戶紀錄。
