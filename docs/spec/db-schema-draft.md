# 崇德志工社網站 — DB Schema / RLS Draft

## 1. Purpose

此文件把 `data-model-spec.md` 轉成可實作的 PostgreSQL schema 草案。

涵蓋：

* table / column
* types 與 constraints
* FK / delete behavior
* indexes
* RLS
* Storage 對應

不涵蓋：

* ORM / query library
* Next.js data-access 程式碼
* slug generation UX
* analytics aggregation queries

對應 domain spec：`docs/spec/data-model-spec.md`  
對應平台決策：`docs/technical-architecture.md`

---

## 2. Decisions Locked by This Draft

這些在 data model spec 裡是 deferred；此草案先拍板，之後 migration 依此實作。

| Topic | Decision |
| --- | --- |
| Naming | `snake_case` tables，複數：`events`、`activity_recaps`、`announcements`、`activity_recap_photos`、`event_interactions`、`site_settings` |
| PK | `uuid`，`gen_random_uuid()` |
| Enums | PostgreSQL `enum`：`publishing_state`、`announcement_severity`、`event_interaction_type` |
| Event time | `timezone` + `is_all_day` + `starts_at` / `ends_at` `timestamptz`（見 §6） |
| Related links | `jsonb` array of `{ "label": string, "url": string }` |
| Recap gallery | 獨立表 `activity_recap_photos`，不用 JSON array |
| Recap caption | 欄位可空，MVP UI 可不填 |
| Announcement slug | MVP **不建** slug / public detail table 需求 |
| Site settings | 單列 typed row；`social_links` 為 `jsonb` |
| Administrator table | **不建**；身份 = `auth.users`，凡 `authenticated` 即 admin |
| Analytics metadata | MVP 只存 `event_id` + `type` + `occurred_at`，不加 fingerprint |
| Hard delete | CMS 以 archive 為主；DB 仍定義 FK behavior 以備硬刪 |
| Access path | Public 讀可用 anon + RLS；所有 mutation 走 Next.js server（見 §12） |

---

## 3. Schema Overview

```text
auth.users                    (Supabase Auth，不自建 Administrator 表)
        │
        └── 凡 authenticated = Admin（RLS helper）

events
  ├── 1:N  activity_recaps.related_event_id     (optional, SET NULL)
  ├── 1:N  announcements.related_event_id       (optional, SET NULL)
  └── 1:N  event_interactions.event_id          (required, CASCADE)

activity_recaps
  └── 1:N  activity_recap_photos.activity_recap_id  (CASCADE)

site_settings                   (exactly one row)
```

PostgreSQL schema：`public`

---

## 4. Enums

```sql
create type publishing_state as enum ('draft', 'published', 'archived');

create type announcement_severity as enum ('info', 'important', 'urgent');

create type event_interaction_type as enum (
  'page_view',
  'registration_click',
  'google_calendar_click',
  'ics_download'
);
```

之後新增 interaction type 只需 `ALTER TYPE ... ADD VALUE`，不必改 `events` 表。

---

## 5. Shared Publishing Columns

以下三表共用語意，**不**合併成 generic `contents` 表：

```text
publishing_state  publishing_state  not null  default 'draft'
published_at      timestamptz       null
created_at        timestamptz       not null  default now()
updated_at        timestamptz       not null  default now()
```

規則：

* `published_at` = **第一次**變成 `published` 的時間，之後不因 archive / 再編輯而清除
* draft 可從未發布 → `published_at` 可為 null
* 第一次 publish 由 application（或 DB trigger）寫入 `published_at`
* `updated_at` 用共用 trigger 維護

```sql
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

可選 trigger（建議有，避免漏寫）：第一次 `publishing_state` 進入 `published` 且 `published_at` 仍為 null 時設為 `now()`。

---

## 6. `events`

### Columns

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `slug` | `text` | no | | unique；generation 規則屬 app，DB 只保證 unique + 非空 |
| `title` | `text` | no | | |
| `summary` | `text` | no | | 獨立短摘要，不從 description 截 |
| `description` | `text` | no | `''` | Markdown-compatible source |
| `cover_image_path` | `text` | yes | | Storage object path，非 URL |
| `timezone` | `text` | no | `'Asia/Taipei'` | IANA name；ICS / 顯示依此 |
| `is_all_day` | `boolean` | no | `false` | |
| `starts_at` | `timestamptz` | no | | 見下方 time model |
| `ends_at` | `timestamptz` | no | | 必須 `>= starts_at` |
| `location_name` | `text` | yes | | |
| `address` | `text` | yes | | |
| `map_url` | `text` | yes | | |
| `registration_url` | `text` | yes | | 外連；網站不存報名資料 |
| `related_links` | `jsonb` | no | `'[]'` | 見下方 shape |
| `is_cancelled` | `boolean` | no | `false` | 人工 override；temporal status 不落庫 |
| `publishing_state` | `publishing_state` | no | `'draft'` | |
| `published_at` | `timestamptz` | yes | | |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |

**不存：** `upcoming` / `ongoing` / `ended`。由 `now()` + `starts_at` / `ends_at` / `is_all_day` / `is_cancelled` 在 domain layer 推導。

### Time model

單一對：`starts_at` / `ends_at` 皆為 **timestamptz**（絕對瞬間），另加 `is_all_day` + `timezone`。

* **Timed：** `starts_at` / `ends_at` 為實際開始與結束瞬間；`timezone` 為顯示與 ICS `TZID`。
* **All-day：** 不把活動模擬成 `00:00–23:59` 給 ICS 用。庫內仍存瞬間以便排序與「進行中」判斷：
  * `starts_at` = 該 timezone 下開始日 `00:00` 對應的 timestamptz
  * `ends_at` = 該 timezone 下 **結束日的次日 00:00**（exclusive end），單日活動則為隔日 00:00
* Calendar / ICS serializer 看到 `is_all_day = true` 必須輸出 `VALUE=DATE`，不可輸出 timed `00:00–23:59`。

Constraint：

```sql
check (ends_at >= starts_at)
check (timezone <> '')
check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')  -- 可在實作時放寬；先當目標格式
```

### `related_links`

```json
[
  { "label": "官方網站", "url": "https://example.com" }
]
```

Constraint（建議）：

```sql
check (jsonb_typeof(related_links) = 'array')
```

元素 shape 由 application / zod 驗證即可；不必在 DB 用沉重 jsonb_path check。

### Indexes

```sql
unique (slug)
index on (publishing_state, starts_at)
index on (starts_at)          -- calendar / upcoming
index on (is_cancelled)
```

Public 列表典型條件：`publishing_state = 'published'`，再依 `starts_at` 排序。

---

## 7. `activity_recaps`

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `slug` | `text` | no | | unique |
| `title` | `text` | no | | |
| `summary` | `text` | no | | |
| `content` | `text` | no | `''` | Markdown-compatible |
| `cover_image_path` | `text` | yes | | Storage path |
| `occurred_on` | `date` | no | | 被回顧活動的主要日期；**不是** `published_at` |
| `related_event_id` | `uuid` | yes | | FK → `events.id` |
| `publishing_state` | `publishing_state` | no | `'draft'` | |
| `published_at` | `timestamptz` | yes | | |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |

FK：

```sql
related_event_id references events(id) on delete set null
```

* Recap 可不綁 Event
* 一篇 Recap 最多一個 Event
* 刪 Event 不刪 Recap，只清關聯

Gallery **不**放在此表。

Indexes：

```sql
unique (slug)
index on (publishing_state, occurred_on desc)
index on (related_event_id)
```

---

## 8. `activity_recap_photos`

對應 spec 的 ordered gallery。獨立表才能穩定排序、單張刪除、對 Storage path 做 FK 語意。

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `activity_recap_id` | `uuid` | no | | FK |
| `storage_path` | `text` | no | | Storage object path |
| `sort_order` | `integer` | no | | 同 recap 內從 0 遞增 |
| `caption` | `text` | yes | | MVP 可不使用 |
| `created_at` | `timestamptz` | no | `now()` | |

```sql
activity_recap_id references activity_recaps(id) on delete cascade
unique (activity_recap_id, sort_order)
index on (activity_recap_id, sort_order)
```

`sort_order` unique 在重排時會短暫衝突；application 應用「先寫臨時值再寫最終值」，或之後改成只 index、不 unique。MVP 可先 unique，重排在 transaction 內完成。

---

## 9. `announcements`

MVP **沒有** slug、沒有獨立 public detail 表需求。Public 以 inline / banner / event detail 為主。

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `title` | `text` | no | | |
| `content` | `text` | no | `''` | Markdown-compatible |
| `severity` | `announcement_severity` | no | `'info'` | |
| `starts_at` | `timestamptz` | yes | | 顯示窗開始；null = 視為自 `published_at` 起可顯示（app 處理） |
| `ends_at` | `timestamptz` | yes | | null = 直到 archive |
| `related_event_id` | `uuid` | yes | | FK → `events.id` |
| `publishing_state` | `publishing_state` | no | `'draft'` | |
| `published_at` | `timestamptz` | yes | | |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |

```sql
related_event_id references events(id) on delete set null
check (ends_at is null or starts_at is null or ends_at >= starts_at)
```

**Active public notice**（給 banner / event inline，**不**寫進 RLS 以免擋住未來 archive 頁）：

```text
publishing_state = published
AND (starts_at IS NULL OR starts_at <= now())
AND (ends_at   IS NULL OR ends_at   >  now())
```

過期 ≠ 刪除，也不自動改 `publishing_state`。

Indexes：

```sql
index on (publishing_state, severity)
index on (related_event_id)
index on (starts_at, ends_at)
```

---

## 10. `site_settings`

單站單列 typed settings，不是 key-value CMS。

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `boolean` | no | `true` | PK，且 `check (id)` → 永遠只能有一行 |
| `organization_name` | `text` | no | | |
| `contact_email` | `text` | yes | | |
| `phone` | `text` | yes | | |
| `address` | `text` | yes | | |
| `social_links` | `jsonb` | no | `'[]'` | 見下 |
| `updated_at` | `timestamptz` | no | `now()` | |

```sql
primary key (id)
check (id = true)
check (jsonb_typeof(social_links) = 'array')
```

`social_links` shape：

```json
[
  { "platform": "facebook", "url": "https://..." },
  { "platform": "instagram", "url": "https://..." }
]
```

`platform` 先當自由 `text`（facebook / instagram / line / youtube / other）。精確白名單可留到 Site Settings feature spec。

Seed：migration 插入一列預設 `organization_name`。

---

## 11. `event_interactions`

Append-only operational analytics。Dashboard 數字由此 aggregate，不在 `events` 上存 counter。

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `event_id` | `uuid` | no | | FK |
| `interaction_type` | `event_interaction_type` | no | | |
| `occurred_at` | `timestamptz` | no | `now()` | |

```sql
event_id references events(id) on delete cascade
index on (event_id, interaction_type, occurred_at desc)
index on (occurred_at desc)
```

不建：user id、IP、UA、fingerprint。去重 / bot filter 若之後要做，再加 **可選** 欄位，不改 Event schema。

寫入只經 Next.js server（見 RLS）。不從 browser 直寫 PostgREST。

---

## 12. Authorization Model

### Roles

| Role | Who | Use |
| --- | --- | --- |
| `anon` | Public site visitors | 讀已發布內容、讀 site settings |
| `authenticated` | Invite-only admin（Supabase Auth） | CMS 全表讀寫 |
| `service_role` | Next.js server only（secret） | 繞過 RLS；用於 analytics insert、必要時的 server jobs |

MVP：**不**建 `admin_profiles` / RBAC。Helper：

```sql
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select auth.role() = 'authenticated';
$$;
```

之後若要限制「只有 allowlist 的 user 才是 admin」，把此 function 改成查 `auth.jwt()` email / `auth.users` 即可，不必改各 policy 內容。

### Access path（與技術架構一致）

```text
Public read     → Next.js server 或 anon client + RLS
CMS mutation    → Next.js server，帶 admin session（authenticated JWT）
                  不要把 service_role 暴露到 browser
Analytics write → Next.js Route Handler / Server Action + service_role
                  （或 authenticated；但 public 使用者無 session，故用 service_role）
```

RLS 是 **defense in depth**。即使有人拿 anon key 打 PostgREST，也讀不到 draft、寫不進 CMS。  
敏感操作仍以 Next.js server 為準，不把 UI 當安全邊界。

**建議關閉** `authenticated` 對 `event_interactions` 的 INSERT（admin 不需要從 CMS 灌假資料；若要測可走 server）。Public insert 也不開，避免被刷爆。

---

## 13. RLS Policies

全部 application 表：`enable row level security`。  
`service_role` 預設 bypass RLS，不必為它寫 policy。

### 13.1 `events`

| Policy | Roles | Command | Using / with check |
| --- | --- | --- | --- |
| `events_public_select` | `anon` | SELECT | `publishing_state = 'published'` |
| `events_admin_select` | `authenticated` | SELECT | `true` |
| `events_admin_insert` | `authenticated` | INSERT | `true` |
| `events_admin_update` | `authenticated` | UPDATE | `true` / `true` |
| `events_admin_delete` | `authenticated` | DELETE | `true` |

Public **看不到** draft / archived。Archived 若將來要在 public 某頁出現，再另開 policy 或改條件。

### 13.2 `activity_recaps`

同 Event：anon 僅 `publishing_state = 'published'`；authenticated 全開。

### 13.3 `activity_recap_photos`

Anon 只能看到 **已發布 recap** 的照片，避免 draft gallery path 外洩：

```sql
-- SELECT for anon
exists (
  select 1
  from activity_recaps r
  where r.id = activity_recap_photos.activity_recap_id
    and r.publishing_state = 'published'
)

-- ALL for authenticated
true
```

### 13.4 `announcements`

| Policy | Roles | Command | Using |
| --- | --- | --- | --- |
| `announcements_public_select` | `anon` | SELECT | `publishing_state = 'published'` |
| admin CRUD | `authenticated` | ALL | `true` |

顯示窗（`starts_at` / `ends_at`）**不**放進 RLS，讓 app 決定 active banner vs 過期仍可讀（未來 archive）。

### 13.5 `site_settings`

| Policy | Roles | Command | Using |
| --- | --- | --- | --- |
| `site_settings_public_select` | `anon` | SELECT | `true` |
| `site_settings_admin_update` | `authenticated` | UPDATE | `true` |
| `site_settings_admin_select` | `authenticated` | SELECT | `true` |

不開 anon INSERT/DELETE。不開 authenticated INSERT/DELETE（單列由 migration seed）。若誤刪，用 service_role 補種。

內容是公開聯絡資訊，不是 secret；不要把 API key 放進此表。

### 13.6 `event_interactions`

| Policy | Roles | Command | Using |
| --- | --- | --- | --- |
| `event_interactions_admin_select` | `authenticated` | SELECT | `true` |

**不開** anon SELECT / INSERT / UPDATE / DELETE。  
寫入僅 `service_role`（Next.js analytics endpoint）。

可選收緊：authenticated 也不開 DELETE/UPDATE，讓此表 append-only。建議 MVP 就這麼做：

```sql
-- authenticated: SELECT only
-- no UPDATE / DELETE policies for anyone except service_role
```

---

## 14. Storage

### Bucket

| Bucket | Public | Purpose |
| --- | --- | --- |
| `media` | public read | Event cover、Recap cover、Recap gallery、少量站台圖 |

MVP 不建第二個 private bucket。Draft 圖片若 path 被猜到可被讀；path 含 uuid，風險可接受。之後若要嚴格隱藏 draft，再改 signed URL。

### Path convention（存在 DB 的 reference）

```text
events/{event_id}/cover.{ext}
recaps/{recap_id}/cover.{ext}
recaps/{recap_id}/gallery/{photo_id}.{ext}
site/{filename}
```

DB 存 **bucket 內 path**（例如 `events/…/cover.webp`），不存完整 public URL，方便換 CDN / bucket。

### Storage policies（`storage.objects`）

```text
SELECT  : public / anon     bucket_id = 'media'
INSERT  : authenticated     bucket_id = 'media'
UPDATE  : authenticated     bucket_id = 'media'
DELETE  : authenticated     bucket_id = 'media'
```

可再限制 `name` 前綴；MVP 先整桶即可。  
上傳建議走 Next.js（session + 寫入對應 `cover_image_path` / photos row），避免 CMS 與 Storage 不一致。

Orphan cleanup、轉檔、大小限制：不在此 schema 強制；屬 upload feature spec。

---

## 15. Illustrative DDL (reference)

實作時拆成 Supabase migrations；以下僅供對照，不是最終 migration 檔。

```sql
create type publishing_state as enum ('draft', 'published', 'archived');
create type announcement_severity as enum ('info', 'important', 'urgent');
create type event_interaction_type as enum (
  'page_view',
  'registration_click',
  'google_calendar_click',
  'ics_download'
);

create table events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null,
  description text not null default '',
  cover_image_path text,
  timezone text not null default 'Asia/Taipei',
  is_all_day boolean not null default false,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location_name text,
  address text,
  map_url text,
  registration_url text,
  related_links jsonb not null default '[]'::jsonb,
  is_cancelled boolean not null default false,
  publishing_state publishing_state not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_time_range check (ends_at >= starts_at),
  constraint events_related_links_array check (jsonb_typeof(related_links) = 'array')
);

create table activity_recaps (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null,
  content text not null default '',
  cover_image_path text,
  occurred_on date not null,
  related_event_id uuid references events (id) on delete set null,
  publishing_state publishing_state not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table activity_recap_photos (
  id uuid primary key default gen_random_uuid(),
  activity_recap_id uuid not null references activity_recaps (id) on delete cascade,
  storage_path text not null,
  sort_order integer not null,
  caption text,
  created_at timestamptz not null default now(),
  unique (activity_recap_id, sort_order)
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null default '',
  severity announcement_severity not null default 'info',
  starts_at timestamptz,
  ends_at timestamptz,
  related_event_id uuid references events (id) on delete set null,
  publishing_state publishing_state not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_window check (
    ends_at is null or starts_at is null or ends_at >= starts_at
  )
);

create table site_settings (
  id boolean primary key default true check (id),
  organization_name text not null,
  contact_email text,
  phone text,
  address text,
  social_links jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint site_settings_social_array check (jsonb_typeof(social_links) = 'array')
);

create table event_interactions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  interaction_type event_interaction_type not null,
  occurred_at timestamptz not null default now()
);

create index events_pub_starts_idx on events (publishing_state, starts_at);
create index events_starts_idx on events (starts_at);
create index recaps_pub_occurred_idx on activity_recaps (publishing_state, occurred_on desc);
create index recaps_event_idx on activity_recaps (related_event_id);
create index recap_photos_order_idx on activity_recap_photos (activity_recap_id, sort_order);
create index announcements_pub_idx on announcements (publishing_state, severity);
create index announcements_event_idx on announcements (related_event_id);
create index interactions_agg_idx
  on event_interactions (event_id, interaction_type, occurred_at desc);
```

---

## 16. Mapping from Domain Spec

| Domain entity | Table | Notes |
| --- | --- | --- |
| Event | `events` | temporal status 不落庫 |
| ActivityRecap | `activity_recaps` | gallery 拆表 |
| ActivityRecap.gallery_images | `activity_recap_photos` | ordered |
| Announcement | `announcements` | 無 slug |
| SiteSettings | `site_settings` | 單列 |
| EventInteraction | `event_interactions` | append-only |
| Administrator | — | `auth.users` + `is_admin()` |

---

## 17. Still Deferred (intentionally)

不擋第一版 migration：

* slug 自動產生、改名、redirect history
* `related_links` / `social_links` 的嚴格 enum 白名單
* all-day 在 SQL 內的精確「進行中」函式（放 domain layer）
* Recap 多個 `occurred_on`
* Announcement 過期後的 public archive UX
* analytics 去重、retention、rate limit
* image 大小 / MIME / 轉檔
* orphan Storage cleanup
* Preview unpublished URLs（若要做，需 signed 或 admin session，不能靠目前 anon SELECT）

---

## 18. Suggested Implementation Order

1. Supabase project + `media` bucket
2. Migration：enums → tables → indexes → triggers → seed `site_settings`
3. RLS + `is_admin()` + Storage policies
4. Next.js env（URL、anon key、**僅 server** 的 service role）
5. 再接 CMS / public queries

Auth：Dashboard 關閉 public signup，用 invite / 手動建立第一個 admin。
