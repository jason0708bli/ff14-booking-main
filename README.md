# ff14-booking

FF14 桌遊店「狐的桌遊地」預約網站。純靜態前端 + Google Apps Script Web App（v8.2）作為資料 API。

## 檔案

- `index.html`：玩家前台，可查看開放班次、包場/併桌預約、加入既有併桌、會員點數查詢。
- `games.html`：桌遊圖鑑，介紹各款可預約遊戲規則與 Canva 說明書連結。
- `admin.html`：主持人後台，登入後發布班次、查看預約、結束班次。
- `adim.html`：舊後台檔名轉址頁。
- `config.js`：GAS Web App URL。
- `gas/Code.gs`：GAS 後端 v8.2（含會員點數）。

## 試算表分頁（名稱必須完全一致）

| 分頁名稱 | 用途 |
|---------|------|
| `主持人帳號表` | 帳號、密碼、顯示名稱、可主持遊戲（逗號分隔） |
| `預約總表` | 班次：ID、日期、時間、主持人、遊戲、狀態 |
| `併桌團員明細` | 預約明細與併桌人數 |
| `會員名冊` | 會員：ID、世界、角色名、點數、登記時間、備註、最後更新 |
| `會員點數紀錄` | 點數異動紀錄（選填，後端自動寫入） |

### 會員名冊欄位（第一列標題）

`memberId` | `server` | `characterId` | `points` | `registeredAt` | `note` | `lastUpdated`

### 會員點數紀錄欄位（第一列標題）

`logId` | `memberId` | `server` | `characterId` | `change` | `balanceAfter` | `reason` | `operator` | `timestamp`

連線失敗時，GAS 錯誤訊息會列出「目前有的分頁」，可据此核对名称。

## Google Apps Script API 契約

### 讀取班次

```text
GET <API_URL>?action=getShifts
```

回傳：

```json
{
  "success": true,
  "data": [
    {
      "shiftId": "S123",
      "date": "2026-06-08",
      "startTime": "18:00",
      "endTime": "23:00",
      "host": "主持人名",
      "gamesOffered": ["FF14 RP", "D&D"],
      "status": "開放中",
      "bookings": []
    }
  ]
}
```

也支援 JSONP：`?action=getShifts&callback=函式名`

### 查詢會員點數

```text
GET <API_URL>?action=lookupMember&server=巴哈姆特&characterId=角色名
```

### POST 動作

| action | 用途 |
|--------|------|
| `login` | 主持人登入 |
| `addShift` | 發布班次 |
| `makeBooking` | 玩家預約（包場/併桌） |
| `joinExistingBooking` | 加入既有併桌 |
| `endShift` | 結束班次 |
| `registerMember` | 後台登記會員（需主持人帳密） |
| `lookupMember` | 查詢會員點數 |
| `adminSearchMembers` | 後台搜尋會員（需主持人帳密） |
| `adjustMemberPoints` | 後台增減點數（需主持人帳密） |

#### 後台會員登記 `registerMember`

```json
{
  "action": "registerMember",
  "username": "主持人帳號",
  "password": "主持人密碼",
  "server": "巴哈姆特",
  "characterId": "角色名"
}
```

#### 後台分配點數 `adjustMemberPoints`

```json
{
  "action": "adjustMemberPoints",
  "username": "主持人帳號",
  "password": "主持人密碼",
  "memberId": "M1234567890",
  "pointsDelta": 10,
  "reason": "完成一局阿瓦隆"
}
```

#### 玩家預約 `makeBooking`

```json
{
  "action": "makeBooking",
  "shiftId": "S123",
  "bookingStartTime": "18:00",
  "bookingEndTime": "20:00",
  "game": "FF14 RP",
  "type": "包場",
  "members": [{ "server": "Cerberus", "characterId": "角色名" }],
  "useGem": false,
  "playerCount": 4,
  "rounds": 1
}
```

#### 主持人發布班次 `addShift`

```json
{
  "action": "addShift",
  "date": "2026-06-08",
  "startTime": "18:00",
  "endTime": "23:00",
  "host": "主持人名",
  "gamesOffered": ["FF14 RP", "D&D"]
}
```

## 部署步驟

1. 確認試算表 ID 與 `gas/Code.gs` 中 `getSpreadsheet()` 一致。
2. 貼上 `gas/Code.gs` → **部署 → 網頁應用程式**（存取權：任何人）。
3. 更新 `config.js` 中的 URL。
4. 測試：`<API_URL>?action=getShifts` 應回傳 `{ "success": true, "data": [...] }`。

## 注意事項

- 預約時段需與其他預約留 30 分鐘緩衝（GAS 端檢查）。
- 併桌上限 10 人（含加入人數）。
- 後台登入凭試算表 `主持人帳號表`，正式公開前建議加强驗證。
