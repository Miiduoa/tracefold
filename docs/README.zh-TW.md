# Tracefold｜網路請求分析工作台

把瀏覽器匯出的 HAR 檔案變成可篩選的請求時間軸。用來回答三個具體問題：哪個請求最慢、哪個資源最大、哪些請求失敗。

[直接操作](https://miiduoa.github.io/tracefold/) · [原始碼與執行方式](../README.md) · [設計取捨](design.md)

## 操作路徑

1. 開啟工作台，先用標示為 synthetic 的 24 筆範例。
2. 按列表上方的「Failed」直接篩出並選取失敗請求。
3. 按「Longest」或「Largest」排序並選取對應請求；時間軸的刻度仍使用整份紀錄。
4. 匯入自己的 HAR；資料在瀏覽器記憶體處理。
5. 匯出摘要。摘要不保留 headers、cookie、body 與 query string，但 hostname、path 仍需自行檢查。

手機點選請求會直接跳到時間分解，可用「Back to requests」回到原本那一列。

## 可以檢查的技術內容

- TypeScript 資料驗證與錯誤定位：錯誤 entry 不會被悄悄略過。
- Sweep-line 計算尖峰併發，同時間的結束事件先於開始事件處理。
- p95 使用 nearest rank；未知值與 0 分開處理。
- HAR 的 TLS 時間已包含於 connect，不重複加總。
- 載入序號避免較早的非同步匯入覆蓋較新的選擇。
- DOM 輸出 escape、無外部執行腳本、無持久化資料儲存。

## 驗證與限制

`npm test` 執行 28 項測試；`npm run build` 檢查型別並建置。介面另外在 Chromium 檢查檔案匯入、錯誤匯入、篩選、排序、下載及手機寬度。

目前不分析 LCP、CLS 或真正的 critical path。只有網路紀錄，不能宣稱已找到整個頁面的效能瓶頸。合成範例與實際網站紀錄分別標示；沒有將單次網站載入包裝成真實客戶效能成效。

## 延伸驗證

- [實際作品集網路紀錄](cases/portfolio.md)：保留三筆測量與兩個匯出器時間差異警告；可在工作台選 Recorded capture。
- [一萬筆請求壓力測試](cases/stress.md)：完整數據、測量腳本與前後比較；每頁只建立 200 列，完整資料仍可搜尋與匯出。
