# 崇德志工社網站 — Technical Architecture

## 1. Architecture Goal

此階段目標是確認 MVP 的主要技術邊界與責任分工。

重點不是提前決定所有 implementation detail，而是先回答：

* Application framework 是什麼
* Database / Auth / Storage 由誰負責
* Calendar integration 放在哪裡
* Analytics data 如何保存
* Public / Admin 是否需要拆成不同系統

目前不進入：

* ORM 選型
* 完整 database schema
* RLS policy 細節
* API contract
* Cache strategy
* CI/CD 細節
* Observability
* 完整 security hardening
* Production infrastructure tuning

---

## 2. High-Level Architecture

MVP 採：

**Next.js + Supabase + Vercel**

概念架構：

```text
                    Browser
                       │
          ┌────────────┴────────────┐
          │                         │
     Public Site                Admin CMS
          │                         │
          └────────────┬────────────┘
                       ↓
                   Next.js
            ┌──────────┼───────────┐
            │          │           │
            ↓          ↓           ↓
        UI / SSR    Server Logic   Routes
                       │
          ┌────────────┼─────────────┐
          │            │             │
          ↓            ↓             ↓
     CMS Operations  Calendar     Analytics
                     / ICS         Writes
          │            │             │
          └────────────┼─────────────┘
                       ↓
                    Supabase
           ┌───────────┼───────────┐
           ↓           ↓           ↓
       PostgreSQL     Auth       Storage
```

Deployment target:

```text
Next.js → Vercel

Database
Auth
Storage → Supabase
```

---

## 3. Application Architecture

### Decision

使用 **Next.js 作為單一 Web Application Framework**。

MVP 不拆：

```text
Frontend
+
Independent Backend API
```

而是由同一個 Next.js application 負責：

* Public Website
* Admin CMS
* Server-side data access
* CMS operations
* Calendar integration
* ICS generation
* Calendar feed
* Lightweight analytics endpoints

---

## 4. Why a Single Next.js Application

目前產品規模不需要獨立 backend service。

拆成：

```text
Next.js
+
FastAPI / NestJS / Other API
```

會額外增加：

* deployment complexity
* authentication boundaries
* API contracts
* local development complexity
* operational overhead

但沒有明確產品收益。

因此 MVP 原則：

> Prefer a modular monolith before distributed services.

未來若真正出現獨立 backend 的需求，再進行拆分。

---

## 5. Backend Platform

### Decision

採用 **Supabase**。

Supabase 在目前架構中負責三個主要能力：

```text
Supabase
├── PostgreSQL
├── Authentication
└── Storage
```

---

## 6. PostgreSQL

PostgreSQL 作為 application data 的 source of truth。

預計保存：

```text
Event

ActivityRecap

Announcement

SiteSettings

EventInteraction

Admin-related metadata
```

具體 schema 尚未在此階段決定。

### Design Principle

Domain model 應盡量保持一般 relational design。

避免僅為方便而大量依賴難以遷移的 platform-specific pattern。

換句話說：

> Supabase 是 managed PostgreSQL platform，而不是產品 domain 本身。

---

## 7. Authentication

### Public Users

Public side：

```text
No authentication
```

使用者不需要：

* Sign up
* Login
* User profile
* Member account

---

### Administrators

Admin 使用 **Supabase Auth**。

MVP 採：

> Invite-only / pre-created administrator accounts

不提供公開註冊。

不需要：

* Public Sign Up
* Social Login
* Member Login
* OAuth-based member system

---

## 8. Authorization Model

MVP 的 Admin permissions 保持簡單。

概念：

```text
Authorized Admin
        ↓
     /admin
        ↓
Can manage all MVP CMS content
```

目前所有 Administrator 可以：

* Manage Events
* Manage Activity Recaps
* Manage Announcements
* Manage Site Settings
* View basic Analytics

MVP 不建立：

* Editor
* Reviewer
* Super Admin
* Event Manager
* Announcement Manager
* Complex RBAC

若未來真正出現多人分工需求，再新增角色系統。

---

## 9. Media Storage

### Decision

圖片與媒體使用 **Supabase Storage**。

主要用途：

* Event cover images
* Activity Recap cover images
* Activity Recap photos
* 少量網站共用圖片

基本 flow：

```text
Admin Upload
      ↓
Supabase Storage
      ↓
Database stores file reference / path
      ↓
Next.js renders media
```

---

## 10. Media Design Principle

MVP 不建立完整的 Digital Asset Management system。

暫時不需要：

* Media Library
* Asset reuse UI
* Folder management system
* Advanced image metadata
* Asset dependency tracking
* Standalone MediaAsset domain

只有真的出現：

* 同一張圖片被多處重用
* 大量圖片需要搜尋
* 刪除媒體需要 dependency analysis

等需求時，再升級 media model。

---

## 11. Analytics Architecture

### Decision

MVP Event Analytics 直接保存於自己的 PostgreSQL。

不把 Google Analytics / PostHog 作為 MVP Event Analytics 的核心依賴。

基本 flow：

```text
Public Interaction
        ↓
Next.js server endpoint
        ↓
EventInteraction
        ↓
Supabase PostgreSQL
        ↓
Admin Dashboard aggregation
```

---

## 12. Initial Analytics Events

MVP 初期：

```text
page_view

registration_click

google_calendar_click

ics_download
```

未來可新增：

```text
share_click

calendar_subscription

map_click

...
```

而不需要修改 Event 本身的 schema 結構。

---

## 13. Analytics Scope

自己的 analytics 系統只處理：

> Event-level operational interactions.

不嘗試自己建立完整網站分析平台。

MVP 暫不處理：

* Traffic attribution
* Marketing funnels
* User identity tracking
* Session replay
* Retention
* Device fingerprinting
* Cross-device tracking
* Behavioral analytics platform

若未來需要這些能力，再評估：

* PostHog
* Google Analytics
* Other analytics providers

---

## 14. Calendar Architecture

### Decision

所有 Calendar integration 由 **Next.js server-side** 從 Event data 衍生。

Source of truth：

```text
Event
  ↓
PostgreSQL
```

Calendar output：

```text
Event Data
   ↓
Next.js Calendar Logic
   ├── Google Calendar URL
   ├── Single-event ICS
   └── All-events Calendar Feed
```

---

## 15. Single Event Calendar Integration

單一 Event 支援：

### Google Calendar

Next.js 根據 Event data 建立 Google Calendar action URL。

不需要：

* Google OAuth
* Google Calendar API
* User Google account access

---

### ICS

Server-side 根據 Event data 產生標準 iCalendar output。

概念 endpoint：

```text
/events/[event]/calendar.ics
```

最終 URL naming 留到 Route Design 階段確認。

---

## 16. Full Calendar Subscription

較低優先級 MVP 功能：

```text
Subscribe to all organization events
```

透過公開 iCalendar feed。

概念：

```text
/calendar/events.ics
```

Feed 由目前已發布 Event data 動態產生。

不需要：

* Subscriber database
* Member account
* Google Calendar API
* Apple Calendar API
* Background synchronization service

Calendar client 自行定期重新讀取 feed。

---

## 17. Calendar Source-of-Truth Principle

不建立：

```text
Event Database

+

Separate Calendar Database
```

也不維護手動生成的：

```text
static .ics files
```

而是：

```text
Event
 ↓
Calendar Serializer
 ↓
ICS / Calendar URL / Feed
```

因此 Event 更新時，calendar output 會從相同資料來源重新產生。

---

## 18. Calendar Domain Logic

Calendar-specific logic 應集中管理，例如：

* Stable event UID
* Date / time serialization
* Timezone handling
* Location
* Description
* Event URL
* Cancellation semantics
* Last modified information

不應將這些邏輯散落在 React components。

具體實作形式留到 Implementation Spec 階段決定。

---

## 19. Proposed Responsibility Boundaries

### Next.js — Public UI

負責：

* Homepage
* About
* Events
* Calendar View
* Event Detail
* Activity Recaps
* Announcement UI
* Contact / Footer

---

### Next.js — Admin UI

負責：

* Admin Login experience
* Dashboard
* Event CMS
* Activity Recap CMS
* Announcement CMS
* Site Settings

---

### Next.js — Server Logic

負責：

* Business rules
* Data mutation
* Content publishing operations
* Event status derivation
* Calendar serialization
* ICS endpoints
* Analytics recording
* Server-side authorization checks

---

### Supabase PostgreSQL

負責：

* Persistent relational application data

---

### Supabase Auth

負責：

* Administrator identity
* Session management

---

### Supabase Storage

負責：

* Uploaded media assets

---

### Vercel

負責：

* Next.js application hosting
* Server runtime
* Deployment

---

## 20. Architecture Principles

### Keep the Domain Portable

Application code should think primarily in terms of:

```text
Event

ActivityRecap

Announcement
```

而不是：

```text
Supabase Row

Supabase Storage Object

Supabase Auth User
```

Platform details 不應主導 domain design。

---

### Do Not Prematurely Split Services

MVP 採：

> Modular Monolith

而不是：

> Microservices

只有當獨立部署、scale 或責任邊界真的帶來價值時才拆。

---

### Server Owns Sensitive Operations

涉及：

* CMS mutation
* Authorization
* Analytics writes
* Calendar generation

等操作，應由可信任的 server-side boundary 處理。

不應依賴 Client UI 本身作為安全邊界。

---

### Database Remains the Source of Truth

重要資料不應分散維護於：

* JSON files
* Static calendar files
* Source code
* Hard-coded CMS content

高頻動態內容均應由 database / storage 提供。

---

## 21. Confirmed Technical Decisions

### Application

* Next.js
* Single application
* Modular monolith
* MVP 不拆獨立 backend

### Backend Platform

* Supabase

### Database

* PostgreSQL

### Authentication

* Supabase Auth
* Admin only
* Invite-only / pre-created accounts
* No public signup

### Authorization

* Simple single-admin-role model
* No complex RBAC

### Media

* Supabase Storage
* No full Media Library in MVP

### Analytics

* EventInteraction stored in PostgreSQL
* Minimal operational analytics only

### Calendar

* Generated server-side by Next.js
* Google Calendar URL
* Single-event ICS
* Full-event calendar feed
* Event remains source of truth

### Deployment

* Next.js on Vercel
* Supabase managed backend services

---

## 22. Explicitly Not Required for MVP Architecture

目前不需要：

* Separate REST backend
* GraphQL service
* Microservices
* Kubernetes
* Message queue
* Redis
* Dedicated search engine
* Background job infrastructure
* Dedicated analytics warehouse
* Kafka / event streaming
* Separate object storage provider
* Separate authentication provider
* Headless CMS
* Full DAM / Media Library
* Complex RBAC
* Google Calendar OAuth integration

若後續需求出現，再重新評估，不提前加入。

---

## 23. Deferred Technical Decisions

以下問題刻意留到 Implementation-ready Spec：

* Next.js exact version
* App Router conventions
* Server Actions vs Route Handlers per operation
* Database access library
* ORM / query builder
* Schema naming
* Migration tooling
* Validation library
* RLS policies
* Service-role usage
* Storage bucket structure
* Image processing
* Calendar library selection
* ICS caching
* Revalidation strategy
* EventInteraction aggregation
* Analytics bot filtering
* Error monitoring
* Logging
* Testing strategy
* Preview implementation
* Environment separation
* CI/CD
* Backup strategy

這些都是 implementation-level decisions，不需要在目前產品架構階段一次決定完。

---

## 24. Current Architecture

```text
                     ┌──────────────────┐
                     │      Users       │
                     └────────┬─────────┘
                              │
               ┌──────────────┴──────────────┐
               │                             │
               ▼                             ▼
        Public Website                   Admin CMS
               │                             │
               └──────────────┬──────────────┘
                              ▼
                      ┌──────────────┐
                      │   Next.js    │
                      │   Vercel     │
                      └──────┬───────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
     CMS / Domain        Calendar           Analytics
       Logic              Logic              Logic
          │                  │                  │
          └──────────────────┼──────────────────┘
                             ▼
                      ┌──────────────┐
                      │   Supabase   │
                      └──────┬───────┘
                             │
               ┌─────────────┼─────────────┐
               │             │             │
               ▼             ▼             ▼
          PostgreSQL        Auth          Storage
```
