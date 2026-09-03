# 崇德志工社網站 — Data Model Spec

## 1. Purpose

此文件定義 MVP 的核心資料模型。

目標是確認：

* 系統有哪些主要 entities
* 各 entity 需要承載哪些核心資訊
* entities 之間的主要關聯
* publishing lifecycle
* event lifecycle
* analytics interaction model
* 必要的資料約束與 derivation rules

目前仍不進入：

* SQL DDL
* exact database types
* index design
* migration scripts
* RLS policies
* ORM model syntax
* API contracts

這些留到 implementation 階段處理。

---

# 2. Domain Overview

MVP 主要 entities：

```text
Core Content
├─ Event
├─ ActivityRecap
└─ Announcement

Supporting
├─ Administrator
├─ SiteSettings
└─ EventInteraction
```

主要關係：

```text
ActivityRecap
      │
      └── optional → Event

Announcement
      │
      └── optional → Event

EventInteraction
      │
      └── belongs to → Event
```

---

# 3. Shared Publishing Model

以下三種 content entity：

* Event
* ActivityRecap
* Announcement

共用一致的 publishing semantics。

核心 metadata：

```text
publishing_state
published_at?
created_at
updated_at
```

## Publishing State

```text
draft
published
archived
```

### draft

* 尚未公開
* 可以持續編輯
* 不出現在 Public Site

### published

* 對外公開
* 可被 Public Site 查詢與顯示

### archived

* 不再作為目前公開內容使用
* 資料仍保留
* 不代表資料被刪除

---

## published_at

代表內容第一次正式發布的時間。

與：

```text
created_at
updated_at
```

屬於不同概念。

---

## Important

共用 publishing semantics **不代表建立 generic `Content` table**。

以下 domains 仍保持獨立：

```text
Event
ActivityRecap
Announcement
```

因為它們具有不同的產品語意與 lifecycle。

---

# 4. Event

`Event` 是整個產品最核心的 domain object。

它是以下功能的唯一活動資料來源：

* Homepage Upcoming Events
* Events List
* Calendar View
* Event Detail
* Registration CTA
* Google Calendar
* Single-event ICS
* Full Calendar Subscription
* Event Analytics
* Admin Event CMS

Calendar 不維護獨立 event dataset。

---

# 5. Event — Core Fields

概念模型：

```text
Event
├─ id
├─ slug
│
├─ title
├─ summary
├─ description
│
├─ cover_image_path?
│
├─ start
├─ end
├─ is_all_day
├─ timezone
│
├─ location_name?
├─ address?
├─ map_url?
│
├─ registration_url?
├─ related_links?
│
├─ is_cancelled
│
├─ publishing_state
├─ published_at?
│
├─ created_at
└─ updated_at
```

Exact field naming 可以在 database schema 階段調整。

---

# 6. Event Content

## title

活動名稱。

用於：

* Event Detail
* Event Cards
* Homepage
* Calendar
* ICS
* Google Calendar

必填。

---

## summary

短版活動摘要。

主要用於：

* Homepage
* Event cards
* Events list
* Compact previews

不依賴 UI 從完整 description 自動截字產生。

---

## description

活動完整內容。

使用 Markdown-compatible source 保存。

可以支援：

* Paragraphs
* Headings
* Lists
* Links
* Basic formatting

Admin UI 不要求使用者直接撰寫 Markdown syntax。

---

# 7. Event Images

## cover_image_path

Optional。

Event 不應因為沒有圖片而無法發布。

Public UI 在沒有 cover 時必須提供一致 fallback visual。

圖片本身保存在：

```text
Supabase Storage
```

Database 保存：

```text
path / reference
```

而不是 image binary 或 base64。

---

# 8. Event Time Model

MVP 的每個 Event 代表：

> 一次具體活動 occurrence。

不建立 recurrence rule。

---

## Timed Event

支援有明確開始與結束時間的活動。

概念：

```text
start
end
timezone
```

---

## All-day Event

Event 同時支援真正的 all-day semantics。

例如：

```text
2026-09-28
```

而不是將其模擬成：

```text
00:00 → 23:59
```

因此資料模型需要明確：

```text
is_all_day
```

Calendar / ICS layer 必須依此產生正確 date semantics。

---

# 9. Event Timezone

每個 Event 保留明確 timezone。

MVP 預設：

```text
Asia/Taipei
```

Admin 一般操作不需要頻繁修改 timezone。

但資料模型不把：

> 所有活動永遠都是台灣時間

當成不可變假設。

Calendar / ICS 皆以 Event timezone 為依據。

---

# 10. Recurring Events

MVP **不支援 recurring event model**。

不建立：

* RRULE
* recurring series
* occurrence exceptions
* edit this occurrence
* edit entire series

若同類活動需要重複建立：

```text
Event
  ↓
Duplicate Event
  ↓
New independent Event
```

Duplicate Event 屬於 Admin UX / feature capability。

每筆 Event 在資料層仍然完全獨立。

---

# 11. Event Location

MVP 不建立獨立 `Location` entity。

Event 直接保存簡單地點資訊：

```text
location_name?
address?
map_url?
```

例如：

```text
崇仁文教館
台中市...
Google Maps URL
```

目前不建立：

* Venue management
* Geolocation search
* Latitude / Longitude requirement
* Location reuse model
* Nearby events

未來真的有大量場地管理需求再重新評估。

---

# 12. Registration

MVP 不建立 registration domain。

Event 只保存：

```text
registration_url?
```

可以指向：

* Google Forms
* ACCUPASS
* External registration system
* Other official registration page

網站不保存：

* participant identity
* registration record
* capacity
* waitlist
* cancellation
* attendance

---

# 13. Event Related Links

Event 可以存在少量相關連結。

概念上可支援：

```text
related_links
```

例如：

* 官方網站
* 詳細資料
* 社群貼文
* 補充說明

Exact representation 留到 schema design。

---

# 14. Event Publishing State

Event 使用 shared publishing lifecycle：

```text
draft
published
archived
```

這代表：

> Event content 是否對外公開。

---

# 15. Event Temporal Status

Event 的 temporal status 與 publishing state 分離。

Conceptually：

```text
upcoming
ongoing
ended
cancelled
```

其中：

```text
upcoming
ongoing
ended
```

主要由：

```text
current time
+
Event start/end
```

自動推導。

Admin 不需要手動更新。

---

## Cancelled

`cancelled` 是人工 override。

概念上可以使用：

```text
is_cancelled
```

而不是將所有 temporal statuses 都保存成一個需要人工同步的欄位。

---

# 16. Event Status Derivation

基本概念：

```text
if cancelled
    → cancelled

else if now < start
    → upcoming

else if start <= now <= end
    → ongoing

else
    → ended
```

All-day event 需要根據 date semantics 做對應推導。

Exact implementation 留到 domain/service layer。

---

# 17. Publishing State vs Temporal Status

兩者不可合併。

合法例子：

```text
published + upcoming
published + ongoing
published + ended
published + cancelled

archived + ended
```

Publishing State 回答：

> 這份內容現在是否公開？

Temporal Status 回答：

> 活動本身現在處於什麼狀態？

---

# 18. ActivityRecap

`ActivityRecap` 是獨立 content entity。

用途：

* 活動成果
* 活動照片
* 活動紀錄
* 過去活動展示
* 組織成果展示

不直接嵌入 Event。

---

# 19. ActivityRecap — Core Fields

概念模型：

```text
ActivityRecap
├─ id
├─ slug
│
├─ title
├─ summary
├─ content
│
├─ cover_image_path?
├─ gallery_images
│
├─ occurred_on
├─ related_event_id?
│
├─ publishing_state
├─ published_at?
│
├─ created_at
└─ updated_at
```

---

# 20. ActivityRecap Content

## title

Recap 標題。

---

## summary

短版摘要。

主要用於：

* Homepage Recent Recaps
* Recap list
* Recap cards

---

## content

完整活動回顧內容。

使用：

```text
Markdown-compatible source
```

保存。

---

# 21. ActivityRecap Cover

`cover_image_path` optional。

用於：

* Recap Card
* Recap Header
* Homepage

若沒有封面圖，Public UI 必須有 fallback。

---

# 22. ActivityRecap Gallery

Recap 支援簡單多圖 Gallery。

需求：

* 多張圖片
* 新增
* 移除
* 排序

不需要：

* image tags
* complex metadata
* asset search
* DAM
* advanced album system

Gallery 圖片存在 Supabase Storage。

Database 保存圖片 references。

---

# 23. ActivityRecap Date

Recap 有自己的：

```text
occurred_on
```

代表：

> 被回顧的活動或事件主要發生日期。

這與：

```text
published_at
```

不同。

---

## When Related to Event

如果 Recap 關聯 Event：

Admin UI 可以預設：

```text
occurred_on = Event date
```

但 Recap 仍然保存自己的 date。

因此 Recap 不依賴 Event 才能存在。

---

# 24. ActivityRecap → Event Relationship

```text
ActivityRecap
      │
      └── optional → Event
```

MVP：

* Recap 可以沒有 Event
* 一篇 Recap 最多關聯一個 Event
* 不做 many-to-many

未來若真的出現：

> 一篇 recap 整理整個系列活動

再考慮多對多模型。

---

# 25. Announcement

`Announcement` 是獨立 content entity。

主要處理：

* Event cancellation
* Time changes
* Location changes
* Temporary notices
* Important reminders
* Organization-wide urgent information

---

# 26. Announcement — Core Fields

概念模型：

```text
Announcement
├─ id
│
├─ title
├─ content
│
├─ severity
│
├─ starts_at?
├─ ends_at?
│
├─ related_event_id?
│
├─ publishing_state
├─ published_at?
│
├─ created_at
└─ updated_at
```

Announcement 是否需要 slug / public detail page，暫時 deferred。

---

# 27. Announcement Content

Announcement 保存：

```text
title
content
```

`content` 使用 Markdown-compatible source。

Announcement UX 相較 Recap 可以更簡單，但資料格式保持一致且 portable。

---

# 28. Announcement Severity

MVP 使用簡單 priority / severity：

```text
info
important
urgent
```

用途主要是：

> 控制 Public UI 顯示的重要程度。

例如：

### info

一般通知。

### important

需要比較明顯呈現的資訊。

### urgent

例如：

* Event cancellation
* Same-day venue change
* Critical temporary information

不建立複雜 classification system。

---

# 29. Announcement Display Window

Announcement 可以設定顯示期間：

```text
starts_at?
ends_at?
```

---

## starts_at

Optional。

如果沒有明確指定，可以預設以 publication time 開始顯示。

---

## ends_at

Optional。

沒有 `ends_at`：

> Announcement 持續有效，直到 Admin archive。

---

## Expiration

當：

```text
now > ends_at
```

Announcement 不再出現在主要 active notification UI。

資料本身不因此刪除。

是否提供完整 historical archive view 留待後續 UX 決策。

---

# 30. Announcement → Event Relationship

```text
Announcement
      │
      └── optional → Event
```

例如：

```text
Announcement:
活動因颱風取消

related_event:
9/28 志工活動
```

這使 Public Event Detail 可以顯示相關 inline notice。

Announcement 本身仍然保持獨立 lifecycle。

---

# 31. SiteSettings

`SiteSettings` 是單一 supporting entity。

MVP 不做：

```text
key
value
```

generic CMS。

而採明確 typed settings。

---

# 32. SiteSettings — Core Fields

概念：

```text
SiteSettings
├─ organization_name
├─ contact_email?
├─ phone?
├─ address?
├─ social_links
└─ updated_at
```

Exact settings 等 Site Settings feature spec 時再收斂。

---

## Cardinality

MVP 預期：

```text
one site
→ one SiteSettings record
```

不是每一項設定一筆 row。

---

# 33. SiteSettings Scope

只保存：

> 少量全站共用、實際可能需要 Admin 遠端修改的內容。

不保存：

* Homepage 全文
* About page 全文
* arbitrary components
* CSS
* page layout
* navigation builder
* footer builder

SiteSettings 不是 page builder。

---

# 34. EventInteraction

`EventInteraction` 是 MVP Event Analytics 的基礎 entity。

目的：

> 記錄某個 Event 發生了一次什麼使用者互動。

---

# 35. EventInteraction — Core Fields

概念：

```text
EventInteraction
├─ id
├─ event_id
├─ interaction_type
└─ occurred_at
```

可以在實作階段加入最低必要 technical metadata，但目前不擴張 tracking scope。

---

# 36. Initial Interaction Types

MVP：

```text
page_view
registration_click
google_calendar_click
ics_download
```

未來可增加：

```text
share_click
calendar_subscription
map_click
...
```

---

# 37. EventInteraction Relationship

```text
Event
  │
  └── 1:N → EventInteraction
```

每個 interaction 屬於一個 Event。

---

# 38. Analytics Design Principle

不把統計直接建模成：

```text
Event
├─ view_count
├─ registration_count
├─ google_calendar_count
└─ ...
```

因為這會讓每增加 interaction type 都需要修改 Event schema。

而採：

```text
EventInteraction
```

作為原始 operational event records。

Aggregation strategy 留到 implementation 階段。

---

# 39. Analytics Privacy Boundary

MVP 不主動保存：

* Public user account
* Device fingerprint
* Detailed identity
* Marketing profile
* Cross-site tracking
* Detailed behavioral sessions

EventInteraction 只服務：

> Lightweight operational analytics.

---

# 40. Administrator

`Administrator` 代表可以存取 Admin CMS 的使用者。

Identity 主要由：

```text
Supabase Auth
```

管理。

---

# 41. Administrator Scope

MVP：

* Admin accounts are pre-created / invite-only
* All Admins have effectively same permissions
* No public signup
* No public member identity
* No complex RBAC

是否需要額外 application-level admin profile table，在 Auth / Schema implementation 階段視需要決定。

目前不預先建立複雜 Administrator domain。

---

# 42. Markdown-compatible Content

以下主要長內容使用 Markdown-compatible source：

```text
Event.description

ActivityRecap.content

Announcement.content
```

---

## Why

目的：

* portable
* human-readable
* 不綁特定 rich-text editor
* 容易 migration
* 容易 versioning / transformation

---

## Admin UX

Admin 不需要理解 Markdown syntax。

CMS 可以提供簡單 editor capability，例如：

* Heading
* Bold
* List
* Link
* Paragraph

Editor UI 與 persistence format 分離。

---

# 43. Media Storage

Media 不直接存在 PostgreSQL。

架構：

```text
Supabase Storage
        ↓
Database stores path/reference
```

適用：

* Event Cover
* Recap Cover
* Recap Gallery
* Limited Site Assets

---

# 44. MediaAsset Entity

MVP 暫時 **不建立完整 MediaAsset domain**。

只有未來真的出現：

* asset reuse
* media library
* dependency tracking
* centralized asset management

等需求時再新增。

---

# 45. Slugs

Public content likely needs stable human-readable URLs。

Potentially：

```text
Event.slug
ActivityRecap.slug
```

但 exact slug rules deferred。

尚未決定：

* automatic generation
* uniqueness scope
* slug editing
* slug history
* redirects after rename

這些留到 Route / Feature Spec。

---

# 46. Derived Data

資料模型應避免儲存可以安全推導的值。

例如：

```text
event temporal status
```

應主要由時間 derivation。

不是每分鐘更新 database status。

---

# 47. Source-of-Truth Rules

## Event

是所有活動相關功能的 source of truth。

---

## Calendar

由 Event 衍生。

不保存第二份活動資料。

---

## Analytics

EventInteraction 保存 interaction records。

Dashboard statistics 由 interaction records aggregate。

---

## Media

Storage object 為實際媒體來源。

Database 保存 reference。

---

# 48. Entity Relationship Summary

```text
                    Event
                      │
         ┌────────────┼─────────────┐
         │            │             │
         │ optional   │ optional    │ 1:N
         ▼            ▼             ▼
 ActivityRecap  Announcement  EventInteraction
```

Supporting：

```text
Administrator
SiteSettings
```

---

# 49. Current Conceptual Model

```text
Event
├─ Identity
├─ Content
├─ Time
├─ Location
├─ Registration
├─ Calendar Source Data
├─ Cancellation
└─ Publishing Metadata


ActivityRecap
├─ Identity
├─ Content
├─ Cover
├─ Gallery
├─ Activity Date
├─ Optional Event Relation
└─ Publishing Metadata


Announcement
├─ Content
├─ Severity
├─ Display Window
├─ Optional Event Relation
└─ Publishing Metadata


SiteSettings
└─ Typed global site configuration


EventInteraction
├─ Event
├─ Interaction Type
└─ Occurred At


Administrator
└─ Managed primarily through Supabase Auth
```

---

# 50. Confirmed Data Model Decisions

## Event

* Single-occurrence only
* No recurring event rule in MVP
* Admin Duplicate Event can handle repeated activities
* Supports timed events
* Supports all-day events
* Explicit timezone
* Default timezone `Asia/Taipei`
* Simple location fields
* No Location entity
* `title + summary + description`
* Markdown-compatible description
* Optional cover image
* External registration URL only
* Publishing lifecycle separate from temporal status
* Upcoming / Ongoing / Ended derived
* Cancelled manually controlled

## ActivityRecap

* Independent entity
* Optional Event relationship
* One Event maximum in MVP
* Own `occurred_on`
* `occurred_on` separate from `published_at`
* Supports cover image
* Supports ordered multi-image Gallery
* Markdown-compatible content

## Announcement

* Independent entity
* Optional Event relationship
* Supports severity
* Severity:

  * info
  * important
  * urgent
* Optional display start
* Optional display end
* Markdown-compatible content
* Shared publishing lifecycle

## SiteSettings

* Single settings entity
* Typed fields
* No generic key-value CMS

## EventInteraction

* Generic interaction records
* Event-level analytics
* Extensible interaction types
* No heavy user tracking

## Publishing

* Event / Recap / Announcement share:

  * draft
  * published
  * archived
  * published_at
  * created_at
  * updated_at

---

# 51. Explicit Non-goals

Data model does not currently support:

* Recurring event engine
* Event series
* Multi-location events
* Location database
* Built-in registration
* Participant records
* Member identity
* Attendance
* Volunteer hours
* Multi-language content
* Generic content table
* Generic CMS fields
* Generic page builder
* Rich DAM
* Advanced analytics identity
* Recap ↔ Event many-to-many
* Advanced role system

---

# 52. Deferred Decisions

The following remain intentionally unresolved:

## Database

* exact SQL types
* UUID strategy
* enum vs text constraints
* indexes
* foreign key delete behavior
* DB naming conventions
* ORM choice
* migration tooling

## Event

* exact start/end representation for all-day vs timed
* related links representation
* slug generation
* validation limits
* whether registration URL is required for certain events

## ActivityRecap

* Gallery table vs structured list
* Gallery caption support
* Exact ordering implementation
* Multiple activity dates

## Announcement

* Whether slug is needed
* Whether public detail page exists
* Whether expired announcements appear in archive
* Default severity

## SiteSettings

* Exact social links structure
* Exact editable settings

## Analytics

* aggregation queries
* retention
* bot filtering
* deduplication
* rate limiting
* anonymous technical metadata

## Media

* bucket naming
* upload limits
* image optimization
* orphan file cleanup

These should be resolved only when required by the next implementation-level specs.

---

# 53. Data Model Completion Gate

This spec is sufficient to proceed because it now defines:

* Core entities
* Entity responsibilities
* Major relationships
* Publishing lifecycle
* Event status lifecycle
* Time model
* Location model
* Content format
* Media references
* Announcement visibility semantics
* Analytics event model
* Explicit non-goals

