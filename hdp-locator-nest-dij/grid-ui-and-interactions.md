# HDP Locator Nest DIJ — Grid UI, Search & Edit Mode

The complete interactive rack map lives in `Views/LocatorNestDIJ/Index.cshtml` (1,053 lines) inside `_Layout_HDPStudio.cshtml` (which sets `mobileBreakpoint = 460` for this controller). The interface uses a dark charcoal workspace (`--card-bg-claude: #22221f`, `--border-claude: #30302a`, `--text-main: #e8e8e3`) engineered for fast visual scanning across dense 30-row storage matrices.

## 1. Horizontal Rack Layout & Nest Header Colors

All Nest groups returned by `GetLocatorData` render side-by-side inside `.nests-horizontal-wrapper` (`overflow-x: auto`) using a non-wrapping `.nests-flex-container` (`display: inline-flex; gap: 12px`). Each rack card (`.nest-card`) receives a header banner color matched case-insensitively by `getHeaderClass(nestName)`:

| Nest Name Match (`includes(...)`) | CSS Class | Banner Color | Visual Swatch |
| :--- | :--- | :---: | :--- |
| `NEST 1` | `.header-nest-1` | `#963523` | Rust Red |
| `NEST 2` | `.header-nest-2` | `#b07c21` | Amber Gold |
| `NEST 3` | `.header-nest-3` | `#355e3f` | Forest Green |
| `NEST 4` | `.header-nest-4` | `#274d7a` | Steel Blue |
| Any other name / fallback | `.header-nest-default` | `#4a4a42` | Charcoal Gray |

## 2. 30-Row Paired-Cell Matrix Structure

Each rack contains a `.nest-table` (`border-collapse: collapse`, white `1px` grid lines, `24px` data row height, `28px` header height) with:

- **Header Row (`<thead>`):** Each column (`col.ColumnName`) spans two sub-columns (`<th colspan="2">`).
- **30 Fixed Data Rows (`r = 1` through `30`):** For every `(Column, Row)` intersection, two tightly coupled `<td>` elements share a seamless border (`cell-main` removes `border-right`, `cell-index` removes `border-left`) and carry identical `data-*` metadata (`data-fno`, `data-nest`, `data-column`, `data-row`, `data-toy-number`, `data-column-row`):

| Sub-Cell Class | Width | Alignment | Displayed Content |
| :--- | :--- | :---: | :--- |
| `.cell-main` | `min-width: 68px; max-width: 100px` | Left (`4px` horizontal padding) | `ftoy_number` (truncated with ellipsis; full text on hover `title`), padlock icon for blocked slots, or empty |
| `.cell-index` | `18px` | Center | `fcolumn_name_row` integer sub-index (or blank if null) |

## 3. Cell State & Nest Zone Color Rules

Cell background coloring is determined in strict precedence order inside `loadNestsData()` and `getCellColorClass(nestName, columnName, rowNum)`:

| Priority | Condition | Visual Style | Main / Index Background | Meaning |
| :---: | :--- | :--- | :---: | :--- |
| **1** | **Blocked (`isBlack`):** `ftoy_number` *(case-insensitive)* is `"BLACK"`, `"BLOCKED"`, or `"-"` | `.cell-active-black` with 45° diagonal stripe overlay (`::after`), muted `<i class="fas fa-lock"></i>`, tooltip `"Blocked"` | `#121210` / `#121210` | Physically unavailable / blocked storage slot |
| **2** | **Available Indexed Slot (`hasRow && !hasToy`):** Has `fcolumn_name_row` assigned, `ftoy_number` empty | Zone-colored via `getCellColorClass(...)` *(see table below)* | Yellow / Green / Orange tint | Open physical slot ready to hold a fixture/toy |
| **3** | **Occupied Slot (`hasToy && !isBlack`):** Non-empty `ftoy_number` | Neutral dark cell with bold white `#ffffff` text | `#1b1b18` / `#22221f` | Slot currently occupied by the displayed Toy Number |
| **4** | **Unassigned Coordinate (`!hasRow && !hasToy`):** No DB record (`data-fno="0"`) or both fields null | Blank neutral dark cell | `#1b1b18` / `#22221f` | Unconfigured coordinate (still clickable in Edit Mode to create a row) |

### Available-Slot Zone Coloring (`getCellColorClass`)

When a slot is indexed (`hasRow`) and empty (`!hasToy`), its tint reflects physical storage zones inside each DIJ Nest:

| Nest (`nestName.toUpperCase()`) | Condition | CSS Class | Main / Index Hex |
| :--- | :--- | :--- | :---: |
| **NEST 1** | All columns & rows | `.cell-active-yellow` | `#33291a` / `#292115` |
| **NEST 2** | Rows `1` – `8` (`rowNum <= 8`) | `.cell-active-yellow` | `#33291a` / `#292115` |
| **NEST 2** | Rows `9` – `30` (`rowNum > 8`) | `.cell-active-green` | `#1a2e1e` / `#142417` |
| **NEST 3** | Columns `Q`, `R`, `S`, `T` *(case-insensitive)* | `.cell-active-orange` | `#381e15` / `#2d1811` |
| **NEST 3** | All other columns | `.cell-active-yellow` | `#33291a` / `#292115` |
| **NEST 4** & Default | All columns & rows | `.cell-active-yellow` | `#33291a` / `#292115` |

## 4. Top Toolbar, Live Search & Match Navigation

The `.menu-header` toolbar sits above the racks (right-aligned) with two pill groups:

1. **Search Pill Group (`.search-group`):**
   - `#search-input` (`260px` desktop width) filters live on every `input` event using case-insensitive substring matching (`toyNum.toLowerCase().includes(query)`) against every `td.cell-main[data-toy-number]`.
   - `#btn-clear-search` (`×`) appears while text is entered and resets input, highlights, and match state.
   - `#search-nav` becomes visible during any non-empty search and shows:
     - **Prev (`#btn-prev-match`, `▲`)** and **Next (`#btn-next-match`, `▼`)** wrap-around cycle buttons (disabled when `0` matches).
     - **Counter (`#search-count`):** Displays `"{currentIndex + 1} / {total}"` when matches exist, or `"0 found"` when none match.
2. **Mode Toggle Pill Group (`.menu-options`):**
   - **Search (`#btn-search-mode`):** Active by default (`#111111` background, white text).
   - **Edit (`#btn-edit-mode`):** Checks server-rendered `isLoggedIn` (`Session["us_usrname"] != null`). If logged out, invokes `openHdpLoginModal()` (or redirects to `~/Welcome/Index` if unavailable). If logged in, activates Edit Mode, hides `#search-box-container`, and clears active search highlights.

### Search Highlighting & Auto-Scroll Behavior

- **All Matches (`.search-match`):** Both `.cell-main` and its sibling `.cell-index` highlight in deep crimson (`#6b2429`).
- **Current Focused Match (`.search-current`):** Overrides the active pair in bright red (`#dc3545`) with `#ffffff` text.
- **Keyboard Shortcut:** Pressing **`Enter`** inside `#search-input` advances (`(currentMatchIndex + 1) % searchMatches.length`) without submitting a form.
- **Smooth Centering:** `highlightCurrentMatch()` calls `match.main.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })`, automatically scrolling the horizontal `.nests-horizontal-wrapper` to center the target Nest column on screen.
- **Post-Reload Search Preservation:** If `loadNestsData()` finishes while `currentMode === "search"` and `#search-input` is non-empty, it dispatches a synthetic `input` event to reapply highlights automatically.

### Responsive Toolbar Breakpoint (`<= 665px`)

At `max-width: 665px`, `.menu-btn span` is hidden (turning **Search** and **Edit** into compact icon-only pill buttons with `padding: 10px 16px`), and `.menu-search-box` narrows from `260px` to `100px` so both toolbar controls stay on a single row on narrow phones.

## 5. Edit Mode & Modal Interaction

When `currentMode === "edit"`:

- `.edit-mode-active` is added to `#nests-container`, switching cursor to `pointer` on all `.cell-main` and `.cell-index` cells.
- **Synchronized Paired-Cell Hover:** CSS rules combine adjacent sibling (`td.cell-main:hover + td.cell-index`) and `:has()` (`td.cell-main:has(+ td.cell-index:hover)`) selectors so hovering either half of a slot highlights the entire slot pair in `#dc3545`.
- **Event Delegation:** A single click listener on `#nests-container` finds `e.target.closest(".cell-main, .cell-index")`, extracts its `data-*` attributes, and opens `#edit-modal` (`Edit Cell Data`).

### Edit Modal Fields (`#edit-modal`)

| Element (`id`) | Type | Role |
| :--- | :--- | :--- |
| `#info-location` | Read-only display | Shows `"{nest} - Column {column}, Row {row}"` |
| `#edit-fno`, `#edit-nest`, `#edit-column`, `#edit-row` | Hidden inputs | Carries primary key (`0` if new coordinate) and rack coordinates |
| `#edit-toy-number` | Text input | Auto-focused on modal open; trimmed before POST (`ftoy_number`) |
| `#edit-column-row` | Number input | Parsed as integer or `null` if blank (`fcolumn_name_row`) |
| `#btn-save-cell` | Submit button | Disables and shows `"Saving..."` during `POST /LocatorNestDIJ/UpdateLocator` |

The modal closes via the header `×` button (`#close-modal-x`), **Cancel** button (`#close-modal-btn`), clicking the blurred `.modal-backdrop`, or automatically upon a successful save (which resets the form and triggers `loadNestsData()`).

## Next Step

Review all controller endpoints, grouping/upsert rules, and the `hdps_dij_ln_mst_locator` schema in [API & Database Schema](./api-and-database.md).
