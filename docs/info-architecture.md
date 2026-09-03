# 崇德志工社網站 — Information Architecture

## 1. IA Goal

網站資訊架構需要同時服務兩種使用情境：

1. 第一次接觸組織的訪客
2. 已熟悉組織、主要回來查活動的使用者

其中 Event 仍是最重要的 repeat-use feature，因此應位於第一層資訊架構。

---

## 2. Primary Navigation

MVP 主導航：

```text
Home
About
Events
Activity Recaps
```

### Home

首頁同時承擔：

* 組織入口
* 活動入口
* 最新內容摘要

首頁不是純形象頁，也不是單純活動列表。

### About

用於說明：

* 組織定位
* 宗旨
* 背景
* 重要組織資訊

屬於主要對外認識入口。

### Events

Events 為第一層主要導航項目，不包在 `Activities` 或其他抽象分類下。

所有活動相關功能皆從 Event domain 衍生。

### Activity Recaps

活動回顧為第一層主要內容入口。

主要用途：

* 展示過去活動
* 呈現組織實際成果
* 提供照片與活動內容紀錄
* 幫助新訪客理解組織實際在做什麼

Activity Recap 是正式 content type，並納入 MVP CMS。

---

## 3. Secondary / Utility Information

### Announcements

原本的 `News` 不作為主導航項目。

重新定位為：

**Announcements / 通知**

主要處理：

* 活動時間異動
* 場地異動
* 臨時取消
* 重要提醒
* 其他具時效性的公告

主要入口傾向設置在網站右上角，例如：

```text
Notification Icon
      ↓
Popover / Drawer
      ↓
Recent Announcements
```

重要通知可以透過 badge 或其他視覺提示顯示。

是否另外提供完整 `/announcements` archive page，留到後續 UX Design 再決定。

---

### Contact

Contact 不佔主要導航位置。

主要透過以下位置提供：

* Footer
* Homepage
* About 頁面中的適當入口

資訊可能包含：

* Contact information
* Social links
* Address
* Organization information

---

## 4. Events Information Architecture

`/events` 為所有活動的統一入口。

不將 Calendar 建立為獨立主要 navigation domain。

概念結構：

```text
/events

[ List View ] [ Calendar View ]
```

### Default View

預設使用：

**List View**

原因：

* 更適合快速理解近期活動
* Mobile usability 較好
* 更符合「接下來有哪些活動」的主要需求

### Calendar View

Calendar 是 Event 的替代瀏覽方式。

它不維護獨立的 Calendar data model。

---

## 5. Event Detail

每個活動應有獨立 detail page：

```text
/events/[event]
```

主要包含：

* Event information
* Date / Time
* Location
* Description
* Registration CTA
* Google Calendar
* ICS
* Related links

未來若 Activity Recap 與 Event 建立關聯，也可以從 Event Detail 導向相關回顧。

---

## 6. Activity Recaps Information Architecture

主要入口：

```text
/recaps
```

或等命名階段再確認最終 URL。

包含：

* Recap list
* Individual recap detail

概念：

```text
Activity Recaps
│
├── Recap A
├── Recap B
└── Recap C
```

每篇回顧可以包含：

* Title
* Cover image
* Date
* Summary
* Content
* Photos
* Related Event

具體資料結構在 Domain Design 階段確認。

---

## 7. Homepage Structure

Homepage 應同時回答：

```text
Who are you?
What can I join?
What have you done?
How can I learn more?
```

建議核心結構：

```text
Hero / Organization Positioning

Upcoming Events
→ 近期可以參與什麼

Recent Activity Recaps
→ 組織最近做了什麼

About Summary
→ 組織是誰

Contact / Social
→ 如何找到組織
```

### Upcoming Events

首頁的重要核心區塊之一。

只顯示少量近期活動摘要，並導向完整 `/events`。

### Recent Activity Recaps

首頁展示近期活動回顧摘要。

目的不只是導流，也是建立組織可信度與活動感。

---

## 8. Content Roles

目前三種主要 dynamic content 應維持清楚分工：

### Events

回答：

> 接下來有什麼可以參加？

### Activity Recaps

回答：

> 我們曾經做過什麼？

### Announcements

回答：

> 現在有什麼需要立即知道？

三者不應合併成單一 News / Posts system，只因為技術上都可以用文章模型表示。

Domain 可以共用部分底層能力，但 Product semantics 應保持分離。

---

## 9. Public Site Tree

```text
Public Website
│
├── Home
│
│   ├── Hero
│
│   ├── Upcoming Events
│
│   ├── Recent Activity Recaps
│
│   ├── About Summary
│
│   └── Contact / Social
│
├── About
│
├── Events
│   ├── List View
│   ├── Calendar View
│   └── Event Detail
│
├── Activity Recaps
│   └── Recap Detail
│
├── Announcements
│   └── Primary access via notification UI
│
└── Contact / Social
    └── Primarily via Footer / Homepage
```

---

## 10. Admin IA — Working Direction

Admin IA 尚未進入 UX 細化，但依目前產品 scope，預期主要包含：

```text
Admin
│
├── Dashboard
│
├── Events
│
├── Activity Recaps
│
├── Announcements
│
└── Site Settings
```

此結構目前只代表 content ownership，不代表最終 sidebar 或 route design。

---

## 11. Confirmed Decisions

* Events 位於主導航第一層。
* Homepage 直接展示 Upcoming Events。
* Events page 同時支援 List / Calendar。
* List 為預設 view。
* Calendar 不成為獨立 domain。
* `News` 不作為主導航內容。
* 臨時重要資訊改為 Announcements / Notifications。
* Announcements 主要透過右上角 notification UI 存取。
* Activity Recaps 正式進入 MVP。
* Activity Recaps 為獨立 content type。
* Activity Recaps 放在主導航第一層。
* Contact 不佔主導航位置。
* Contact / Social 主要放在 Footer 與 Homepage。
* Homepage 同時展示 Upcoming Events 與 Recent Activity Recaps。

---

## 12. Deferred Decisions

以下問題不需要在 IA 階段解決：

* Announcement 是否需要 archive page
* Notification UI 最終使用 popover 或 drawer
* Activity Recap 最終 URL 命名
* Event 與 Activity Recap relationship 的資料模型
* Search
* Filtering
* Event categories
* Tags
* Pagination
* Breadcrumbs
* Mobile navigation pattern
* Admin sidebar layout
* Exact route naming

這些應在 Domain Design、UX Design 或 implementation-ready spec 階段處理。

---

## 13. IA Completion Gate

目前資訊架構已足以回答：

* 使用者從哪裡進入主要內容
* Events 在網站中的地位
* Upcoming / Past content 如何區分
* Announcements 如何呈現
* Homepage 承擔哪些內容角色
* 哪些內容應出現在主要 navigation

因此 IA 階段可以視為完成。

下一階段：

**Core Domain Design**
