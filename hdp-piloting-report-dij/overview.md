# HDP Piloting Report DIJ — Overview

**HDP Piloting Report DIJ** is an Industrial Engineering (IE) piloting log, Mimaki RasterLink AI-OCR data capture tool, hourly-output & ink-yield calculator, and dual automated Excel exporter inside the **HDP Studio** suite (solution `LoginAndRegisterMVCMD5.sln`, repository `inside-mvc`). Implemented under `Controllers/OCRController.cs` for **Digital Inkjet (DIJ)** operations (`fprocess_code = "C05"`), it eliminates manual transcription of Mimaki RasterLink property screenshots by sending captured images to the **Google Gemini Vision API**, computing standard IE cycle-time output and multi-angle ink yields, storing append-only revision history in SQL Server, and exporting both a **38-column Piloting Report** and a **6-column `XLOOKUP` OEE Report** to a shared network directory.

> [!NOTE]
> All routes, controller actions, Razor views, IE formulas, Gemini OCR field mappings, and database tables documented here are verified directly against `inside-mvc`. Credentials, Gemini API keys, connection strings, personal email addresses, and internal file-server hostnames are sanitized or excluded.

## Purpose & Operational Scope

HDP Piloting Report DIJ supports three end-to-end DIJ piloting workflows:

1. **AI-Assisted & Manual Piloting Data Capture (`/OCR`):** IE engineers capture one or more Mimaki RasterLink screenshots (via clipboard paste / `Ctrl+V`, file browse, external window snipping, or in-page capture), extract 40 structured properties via Google Gemini Vision, auto-populate Toy/Mold details from a 3-table Part Number lookup cascade, validate conditional **DPU** (`Yes`/`No`) requirements, and save immutable piloting revisions.
2. **IE Cycle-Time, Hourly Output & Ink-Yield Engineering:** Automatically computes `Output per Hour` (floored to the nearest multiple of `10`) from print cycle time, cavity output per print, print angle, standard allowance (`5%–6%`), and configured nest handling / auto-cleaning / auto-wiping times — while dynamically scaling all 10 ink yield channels and total ink consumption across multi-angle prints.
3. **Dual Scheduled Network Reporting & Administration (`/OCR/Settings`):** Runs a shared background `System.Threading.Timer` with **EPPlus** to export both the full **38-column Piloting Report** (`fproject_no = 1`) and a deduplicated **6-column OEE Report** (`fproject_no = 2`) with live Excel `XLOOKUP` links to external MRP and DIJ capacity workbooks, all configurable live through a 3-tab Settings UI without recycling IIS.

## Technology Stack

| Layer | Technology / Component | Usage in HDP Piloting Report DIJ |
| :--- | :--- | :--- |
| **Runtime & Web Framework** | ASP.NET MVC 5 · .NET Framework 4.7.2 | Routing, Razor view rendering, 20 actions, stacked `[ValidateAntiForgeryToken]` + custom `[ValidateAntiForgeryTokenAjax]` |
| **ORM & Persistence** | Entity Framework 6 (Database-First EDMX) · SQL Server | Dual `DbContext` access (`HDPStudioEntities` across 7 tables + `ProddevEntities2.pd_user` for user name resolution) |
| **AI Vision OCR** | Google Gemini REST API (`generateContent`) via `HttpClient` | Dynamic API key & model loaded from `hdps_common_mst_aiapikey` (`fproject_name = "OCR"`, `fno_ai_api_key = 1`) |
| **Layout Shell** | Razor `_Layout_HDPStudio.cshtml` | Top bar (`HDP Piloting Report DIJ`), `1030px` mobile breakpoint, read-only auth bypass, `isOcrSidebar` gear shortcut to `/OCR/Settings` |
| **Capture & Frontend UI** | jQuery 3.6.0 · DataTables 1.11.5 · Buttons/JSZip · `html2canvas` 1.4.1 · `getDisplayMedia` / `CaptureController` · `moment.js` 2.29.1 | Multi-mode screenshot capture & cropping, concurrent batch OCR merge, 4-mode review modal, 39-column DataTable, client-side Excel export |
| **Automated Network Export** | `System.Threading.Timer` · EPPlus (`OfficeOpenXml`, `NonCommercial` + `ExternalReferences`) | Dual scheduled `.xlsx` exports (`AutoExport - Piloting Report.xlsx` & `AutoExport - OEE Report.xlsx` with `XLOOKUP`) |

## Module Pages & Entry Points

| Route (`OCRController`) | View (`Views/OCR/`) | Access Model | Purpose |
| :--- | :--- | :--- | :--- |
| `/OCR` *(or `/OCR/Index`)* | `Index.cshtml` (4,234 lines) | Open read-only; client login gate (`requireLogin()`) for Add, OCR, Edit & Delete | Main capture dock, batch Gemini OCR review modal, 39-column DataTable, client-side Excel export |
| `/OCR/Settings` | `Settings.cshtml` (692 lines) | Open *(see security note in System Architecture)* | 3-tab settings workspace for Piloting Report auto-export, OEE Report auto-export, and 4 IE cycle-time defaults |

### HDP Studio & Legacy Entry Points

| Entry Point | Source File | Label / Presentation | Target Route |
| :--- | :--- | :--- | :--- |
| **HDP Studio Hub** | `Views/HDPStudio/Index.cshtml` | Card **#4 — Piloting Report DIJ** (category `DIJ`, banner `#CACADB`, searchable via `piloting report dij ocr optical inspection camera print quality hourly calculate`) | `~/OCR` *(new tab)* |
| **HDP Studio App Launcher** | `Views/Shared/_Layout_HDPStudio.cshtml` | **Piloting Report DIJ** tile | `~/OCR` *(new tab)* |
| **HDP Studio Right Strip (`isOcrSidebar`)** | `Views/Shared/_Layout_HDPStudio.cshtml` | Gear icon (`#rsBtn-settings`) docked at bottom right | `/OCR/Settings` |
| **Legacy INSIDE Sidebars** | `Views/Shared/Sidebar/_Decoration.cshtml` & `_LayoutPage4.cshtml` | **Piloting Report DIJ** (`fa-camera`) | `~/OCR` *(new tab)* |

> [!IMPORTANT]
> **Read-Only Shell Exemption:** In `_Layout_HDPStudio.cshtml`, `currentController == "OCR"` bypasses the full-page session login wall so anyone on the shopfloor can inspect piloting records and export the visible table. On `Index.cshtml`, write actions (`Add data`, `Paste/Browse/Capture`, `Process OCR`, `Edit`, `Delete`) prompt for login via `requireLogin()`.

## Key Features at a Glance

- **4 Image Capture Modes:** Supports **Paste image** (Clipboard API + global `Ctrl+V` working on both HTTP and HTTPS), **Browse image** (`FileReader`), **Capture out** (external desktop window capture via `getDisplayMedia` + `CaptureController` + full-screen cropper), and **Capture in** (`html2canvas` page snipping).
- **Concurrent Multi-Image Batch OCR:** Capturing multiple screenshots (e.g., scrolling RasterLink Properties tabs) sends all cards concurrently to `ProcessOcrGemini` via `Promise.all` and merges extracted fields using first-non-empty precedence.
- **3-Table Part Number Auto-Fill Cascade:** Entering or selecting a `Part No` automatically resolves `Toy No`, `Toy Desc`, and `Molded No` across `hdps_st_log_qrcodedata`, `hdps_common_mst_paintpartlist`, and prior `hdps_ocr_log_rasterlinkpropertiesdataset` records.
- **Conditional DPU (`Yes` / `No`) Form Validation:** Selecting `DPU = Yes` collapses and clears all 31 technical/cycle-time/ink/packing fields so only core sample identification is required.
- **Append-Only Revision History:** Clicking **Edit** pre-fills the modal from an existing record but saves with `fno = 0`, preserving prior revisions for auditability while OEE auto-export automatically selects the newest revision per `fpart_no`.
- **Dual Export Pipelines (Client + Server):** Users can click **Export to Excel** (`excelHtml5`, reversing rows into chronological order and reordering ink columns) or rely on the two scheduled server-side EPPlus `.xlsx` reports.

## Documentation Map

| Chapter | What It Covers |
| :--- | :--- |
| 1. **Overview** *(this page)* | Operational scope (`C05`), technology stack, pages, entry points, and capabilities |
| 2. [System Architecture](./system-architecture.md) | 4 Mermaid diagrams (component, Gemini OCR sequence, dual EPPlus export, Part No cascade) + security/hygiene observations |
| 3. [UI, OCR Capture & Settings](./ui-ocr-and-settings.md) | Capture dock, batch OCR cards, 4-mode review modal, DPU logic, 39-col DataTable, and 3-tab Settings UI |
| 4. [Cycle Time, Ink Math & OCR Logic](./formulas-and-ocr-logic.md) | Exact `mm:ss` math, `Output per Hour` equation + worked example, multi-angle ink scaling, and 40-field Gemini prompt |
| 5. [API & Auto-Export Reference](./api-and-auto-export.md) | All 20 `OCRController` actions, custom AJAX CSRF filter, 38-col Piloting `.xlsx`, and 6-col `XLOOKUP` OEE `.xlsx` |
| 6. [Database Schema](./database-schema.md) | ER diagram and column definitions across `HDPStudioEntities` (7 tables) and `ProddevEntities2` (`pd_user`) |
| 7. [Operator & IE Admin Guide](./user-guide.md) | Daily RasterLink capture & review workflow, Settings administration, and troubleshooting |
