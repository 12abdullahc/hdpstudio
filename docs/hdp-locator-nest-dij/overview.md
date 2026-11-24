# HDP Locator Nest DIJ — Overview

**HDP Locator Nest DIJ** is a visual shopfloor fixture and nest-storage locator module inside the **HDP Studio** suite (solution `LoginAndRegisterMVCMD5.sln`, repository `inside-mvc`). Built for **Digital Inkjet (DIJ)** tooling operations, it renders physical storage racks (**NEST 1** through **NEST 4** and any additional nests) as horizontally aligned 30-row paired matrices, allowing operators to search for a Toy Number instantly without logging in while giving authenticated tooling administrators an inline **Edit Mode** to maintain slot assignments.

> [!NOTE]
> All routes, controller actions, Razor view logic, color rules, and Entity Framework entities documented here are verified directly against `inside-mvc`. Credentials, connection strings, personal email addresses, and internal hostnames are intentionally excluded.

## Purpose & Operational Scope

HDP Locator Nest DIJ serves two complementary shopfloor workflows:

1. **Open-Access Toy & Fixture Lookup (Search Mode):** Shopfloor operators can open the locator map with zero login friction, type a full or partial Toy Number (`ftoy_number`), cycle through all matching slots across every storage rack (`Prev` / `Next` / `Enter`), and immediately identify the exact **Nest**, **Column**, and **Row** — along with zone color cues showing open vs. blocked storage slots.
2. **Authenticated Slot Administration (Edit Mode):** Logged-in INSIDE users can toggle **Edit** mode, hover over paired slot cells, open the **Edit Cell Data** modal, and create, update, clear, or block (`BLACK` / `BLOCKED` / `-`) slot records directly in SQL Server via a CSRF-protected upsert endpoint.

## Technology Stack

| Layer | Technology / Component | Usage in HDP Locator Nest DIJ |
| :--- | :--- | :--- |
| **Runtime & Web Framework** | ASP.NET MVC 5 · .NET Framework 4.7.2 | Routing, Razor view rendering, CSRF & session-protected JSON API (`LocatorNestDIJController.cs`) |
| **ORM & Persistence** | Entity Framework 6 (Database-First EDMX) · SQL Server | Single `DbContext` (`HDPStudioEntities`) targeting `hdps_dij_ln_mst_locator` |
| **Layout Shell** | Razor `_Layout_HDPStudio.cshtml` | Top navigation bar (`HDP Locator Nest DIJ`), app launcher, `460px` mobile breakpoint, login modal, read-only auth bypass |
| **Frontend UI** | Vanilla ES6 JavaScript · CSS Flexbox & `:has()` · FontAwesome 6 | Horizontally scrollable rack cards, 30-row paired-cell tables, color-coded zones, live search navigation, edit modal |

## Entry Points & HDP Studio Integration

The module is a single-page MVC workflow rooted at `/LocatorNestDIJ` (`Index` action) and linked from four navigation points inside `inside-mvc`:

| Entry Point | Source File | Label / Presentation | Target Route |
| :--- | :--- | :--- | :--- |
| **HDP Studio Hub** | `Views/HDPStudio/Index.cshtml` | Card **#3 — Locator Nest DIJ** (category `DIJ`, banner `#BCD1CA`, searchable via `locator nest dij alignment calibration fixtures nest precision target`) | `~/LocatorNestDIJ` *(new tab)* |
| **HDP Studio App Launcher** | `Views/Shared/_Layout_HDPStudio.cshtml` | **Locator Nest DIJ** tile | `~/LocatorNestDIJ` *(new tab)* |
| **Legacy INSIDE Decoration Sidebar** | `Views/Shared/Sidebar/_Decoration.cshtml` | **Locator Nest DIJ** (`fa-crosshairs`) | `~/LocatorNestDIJ` *(new tab)* |
| **Legacy INSIDE Main Sidebar** | `Views/Shared/_LayoutPage4.cshtml` | **Locator Nest DIJ** (`fa-crosshairs`) | `~/LocatorNestDIJ` *(new tab)* |

> [!IMPORTANT]
> **Split Access Model (Open View / Authenticated Edit):** In `Views/Shared/_Layout_HDPStudio.cshtml`, `currentController == "LocatorNestDIJ"` bypasses the full-page session login wall so shopfloor screens can open and search the locator map immediately. Switching to **Edit** mode checks `Session["us_usrname"] != null` both in the browser (opening `openHdpLoginModal()`) and on the server inside `POST /LocatorNestDIJ/UpdateLocator`.

## Key Features at a Glance

- **Side-by-Side Color-Coded Nest Racks:** Renders each `flocator_nest` group as a horizontally scrollable card with distinct header colors for **NEST 1** (rust red), **NEST 2** (amber gold), **NEST 3** (forest green), **NEST 4** (steel blue), and default charcoal.
- **30-Row Paired-Cell Storage Matrix:** Every column displays `30` vertical slots (`r = 1..30`) pairing the Toy Number (`.cell-main`) with its slot sub-index `fcolumn_name_row` (`.cell-index`).
- **Zone Availability & Blocked-Slot Visualization:** Distinguishes occupied slots, blocked slots (`BLACK`, `BLOCKED`, `-` with diagonal hatching and a padlock icon), and available indexed slots colored by Nest/Row/Column zone (`NEST 2` rows `1–8` vs `9–30`; `NEST 3` columns `Q–T` vs others).
- **Real-Time Substring Search & Match Cycling:** Highlights all matches in deep crimson, highlights the active match in bright red, displays a live `current / total` (or `0 found`) counter, cycles with `Enter` / `▲` / `▼`, and smoothly centers the active slot via `scrollIntoView`.
- **Upsert-Backed Inline Cell Editing:** Authenticated users can edit existing records by `fno` or populate previously empty grid coordinates (`data-fno="0"`), automatically inserting a new database row when needed.

## Documentation Map

| Chapter | What It Covers |
| :--- | :--- |
| 1. **Overview** *(this page)* | Operational scope, technology stack, entry points, split read/edit access model, and capabilities |
| 2. [System Architecture](./system-architecture.md) | 3 Mermaid component, transaction, and rendering diagrams plus verified security and code-hygiene notes |
| 3. [Grid UI, Search & Edit Mode](./grid-ui-and-interactions.md) | Rack layout, Nest 1–4 header & zone color rules, blocked sentinels, search navigator, and edit modal |
| 4. [API & Database Schema](./api-and-database.md) | All 3 `LocatorNestDIJController` actions, grouping/upsert rules, `hdps_dij_ln_mst_locator` ER diagram & SQL queries |
| 5. [Operator & Admin Guide](./user-guide.md) | Daily toy lookup workflow, slot administration, blocking/clearing slots, and troubleshooting |
