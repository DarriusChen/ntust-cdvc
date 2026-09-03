# 崇德志工社網站 — UX / Core User Flows

## 1. UX Goal

此階段確認核心使用者如何完成主要任務。

目前不進入：

* Pixel-level UI
* 視覺樣式
* Component design
* 完整表單欄位
* Empty state
* Error state
* Micro-interaction
* Responsive detail

重點是先確定 Public Visitor 與 Admin 的主要操作流程。

---

## 2. Public Event Discovery Flow

`/events` 採 **Upcoming-first**。

主要回答：

> 接下來有哪些活動可以參加？

概念結構：

```text
Events

Upcoming Events
├── Event A
├── Event B
└── Event C

Past Events
├── Event D
└── Event E
```

### Confirmed

* Upcoming Events 是主要內容。
* Past Events 保留，但資訊層級較低。
* Past Events 不應淹沒主要活動入口。
* 過去成果與活動展示主要由 `Activity Recaps` 承擔。
* Calendar View 同樣以現在與未來活動為主要使用情境。

---

## 3. Public Event Participation Flow

核心流程：

```text
Homepage / Events
        ↓
   Event Detail
        ↓
 ┌──────┼─────────────┐
 ↓      ↓             ↓
Register Google     Download
         Calendar      ICS
```

### Event Detail CTA Priority

活動詳情頁主要操作依序為：

1. **前往報名**
2. **加入 Google Calendar**
3. **下載 ICS**
4. **其他相關連結**

### Behavior

若活動存在 `registration_url`：

> Registration 是 primary CTA。

若沒有 `registration_url`：

> Calendar interaction 可以自然提升為主要 CTA。

### UX Principle

不同操作不應全部使用相同視覺權重。

頁面應清楚回答：

> 使用者看完活動後，下一步最可能要做什麼？

---

## 4. Announcement UX

Announcements 主要透過網站右上角通知入口集中呈現。

概念：

```text
Header
   │
   └── Notification
           ↓
      Announcement List
```

但重要資訊不能只存在 Notification UI。

---

## 5. Event-related Announcement Flow

若 Announcement 與特定 Event 強相關，例如：

* 活動取消
* 活動延期
* 時間更改
* 場地更換
* 臨時重要提醒

則 Announcement 應同步出現在該 Event Detail。

概念：

```text
Event Detail

[ Important Notice ]
活動時間已更改……

Event Information

Registration / Calendar CTA
```

### UX Principle

> 會直接影響使用者是否參加活動的重要資訊，不應要求使用者主動打開 Notification 才能看到。

因此：

```text
Announcement Center
        +
Related Event Inline Notice
```

兩種呈現方式可以並存。

---

## 6. Admin Event Creation Flow

Event 採簡單 publishing workflow：

```text
Create Event
     ↓
    Draft
     ↓
   Preview
     ↓
   Publish
```

### Draft

Admin 可以：

* 儲存尚未完成內容
* 補充圖片
* 確認活動時間
* 確認報名 URL
* 檢查活動資訊

Draft 不出現在 Public Site。

### Preview

Admin 可以在正式發布前確認公開呈現結果。

### Publish

發布後 Event 正式出現在：

* Events
* Homepage Upcoming Events
* Calendar View
* Event Detail
* Calendar integrations

具體資料同步方式留到 Architecture / Implementation 階段。

---

## 7. Editing Published Events

已發布 Event 不需要重新進入複雜 approval workflow。

流程：

```text
Published Event
      ↓
     Edit
      ↓
 Save Changes
      ↓
Public Content Updated
```

MVP 不建立：

* Reviewer
* Approval queue
* Multi-stage approval
* Content moderation workflow

---

## 8. Activity Recap Publishing Flow

Activity Recap 使用與 Event 相近的 publishing mental model：

```text
Create Recap
     ↓
    Draft
     ↓
   Preview
     ↓
   Publish
```

目的是：

* 允許內容逐步編輯
* 支援圖片與文字確認
* 發布前先看到公開呈現

---

## 9. Announcement Publishing Flow

Announcement 本身比 Event / Recap 輕量，因此採：

```text
Create Announcement
        ↓
       Draft
        ↓
      Publish
```

Preview 可以提供，但不作為必要步驟。

### Design Principle

Event、Activity Recap、Announcement 應盡量共享相同的內容管理心智模型：

```text
Draft
  ↓
Publish
  ↓
Archive
```

而不是為每種內容建立完全不同的 CMS 操作模式。

---

## 10. Core Public Flows

### Discover and Join Event

```text
Homepage
   ↓
Upcoming Event
   ↓
Event Detail
   ↓
Registration
```

或：

```text
Events
   ↓
List / Calendar
   ↓
Event Detail
   ↓
Registration
```

---

### Add Event to Calendar

```text
Event Detail
      ↓
 ┌────┴───────────┐
 ↓                ↓
Google          ICS
Calendar
```

---

### View Past Activity

```text
Homepage
   ↓
Recent Recap
   ↓
Recap Detail
```

或：

```text
Activity Recaps
       ↓
   Recap Detail
```

---

### Receive Important Information

```text
Header Notification
        ↓
Announcement
```

若與 Event 有關：

```text
Event Detail
     ↓
Inline Important Notice
```

---

## 11. Core Admin Flows

### Manage Event

```text
Admin
  ↓
Events
  ↓
Create / Edit
  ↓
Draft
  ↓
Preview
  ↓
Publish
```

---

### Manage Activity Recap

```text
Admin
  ↓
Activity Recaps
  ↓
Create / Edit
  ↓
Draft
  ↓
Preview
  ↓
Publish
```

---

### Manage Announcement

```text
Admin
  ↓
Announcements
  ↓
Create / Edit
  ↓
Draft
  ↓
Publish
```

---

## 12. Confirmed UX Decisions

* Events 採 Upcoming-first。
* Past Events 保留但降為 secondary。
* Event Detail 以 Registration 為 primary CTA。
* Google Calendar 為第二優先操作。
* ICS 為第三優先操作。
* Announcement 主要集中於 Notification UI。
* 高影響 Event Announcement 同時出現在 Event Detail。
* Event 支援 Draft → Preview → Publish。
* Published Event 可以直接編輯更新。
* Activity Recap 支援 Draft → Preview → Publish。
* Announcement 支援 Draft → Publish。
* Announcement Preview 為 optional。
* 三種內容盡量共享一致 publishing mental model。
* MVP 不建立 approval workflow。

---

## 13. Deferred UX Decisions

以下細節留到更接近 implementation-ready spec 時處理：

* Events filtering
* Event categories
* Past Events 展示方式
* Calendar desktop/mobile behavior
* CTA button exact layout
* Event sharing
* Notification badge logic
* Announcement unread semantics
* Popover vs Drawer
* Preview implementation
* Autosave
* Unsaved changes warning
* Form validation UX
* Image upload UX
* Admin table layout
* Dashboard layout
* Empty / loading / error states

這些目前都不影響核心產品方向。

---

## 14. UX Completion Gate

目前已能清楚回答：

* Public Visitor 如何找到活動
* 如何完成報名
* 如何加入 Calendar
* 過去活動如何被瀏覽
* 重要公告如何觸達使用者
* Admin 如何建立與發布核心內容
* 不同內容是否共享一致管理模式

因此 Core User Flows 階段可以視為完成。

下一階段：

# Technical Architecture
