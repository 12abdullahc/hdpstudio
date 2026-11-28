# HDP Piloting Report DIJ — UI, OCR Capture & Settings

The user interface spans two Razor views rendered inside `_Layout_HDPStudio.cshtml`: the primary capture/review/table workspace (`Views/OCR/Index.cshtml`, 4,234 lines) and the dedicated configuration dashboard (`Views/OCR/Settings.cshtml`, 692 lines) accessible from the right-edge `isOcrSidebar` gear icon.

## 1. Main Dashboard Layout (`Views/OCR/Index.cshtml`)

`Index.cshtml` splits the viewport into two main regions:

1. **Left Capture Dock (`.capture-wrapper`):**
   - **Action Card (`.capture-controls`, `210px` wide):** Divided into **Add data without OCR** (`#addDataBtn`) and **Add data with OCR** (`#pasteBtn`, `#browseBtn`, and split capture button `#captureDropdownText` / `#captureDropdownCaretBtn`). Every write button shows a subtle padlock icon when `isLoggedIn == false`.
   - **Capture Preview Queue (`#capturePreviewsContainer`):** Appears automatically as soon as at least one image is added, anchored by the blue **Process OCR** button (`#processOcrBtn`, `#2F61A8`) above a vertical stack of captured thumbnail cards (`#captureCardsList`).
2. **Main DataTable Workspace (`.main-container`):** Houses a loading spinner (`#tableSpinner`) and the 39-column scrollable DataTable (`#ocrTable`).

## 2. Four Screenshot Capture Modes & Batch OCR Queue

Every image added through any of the four capture methods calls `createCaptureCard(imgData)`, appending a numbered preview card (`Capture 1`, `Capture 2`, ...) with click-to-zoom full lightbox (`#imagePreviewModal`), PNG download (`downloadCapture`), and card removal (`deleteCapture`).

| Mode | Trigger | Browser API / Library | How It Works |
| :--- | :--- | :--- | :--- |
| **Paste image** | `#pasteBtn` or global `Ctrl + V` anywhere on page | `navigator.clipboard.read()` + `document` `paste` event | Button reads image blobs via Clipboard API; global `Ctrl + V` works on both HTTP and HTTPS without extra clipboard prompts |
| **Browse image** | `#browseBtn` -> hidden `#imageFileInput` (`accept="image/*"`) | HTML5 `FileReader.readAsDataURL` | Loads any local PNG/JPG screenshot and resets input value so the same filename can be re-selected |
| **Capture out** *(default split button)* | `#captureDropdownText` / menu item **Capture out** (`startAppCapture()`) | `navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "window" } })` + `CaptureController` | Shows instruction toast, requests window/screen share while applying `controller.setFocusBehavior("no-focus-change")` when supported, captures a high-res frame after `300ms`, stops stream tracks, and launches a full-viewport crop overlay (`startSnippingModeForApp`, `Esc` to cancel) |
| **Capture in** | Split dropdown menu item **Capture in** (`startSnippingMode()`) | `html2canvas` `1.4.1` | Draws a dimmed full-viewport drag-selection canvas (`#snippingCanvas`), snapshots `document.body`, and crops the selected `(x + scrollX, y + scrollY, w, h)` rectangle to PNG |

### Concurrent Batch OCR Merging (`#processOcrBtn`)
Clicking **Process OCR** sends **every** queued capture card in `#captureCardsList` concurrently to `POST /OCR/ProcessOcrGemini` via `Promise.all`:
- Strips `^data:image/[a-z]+;base64,` from each image `src`.
- Iterates responses in card order and merges extracted fields into `mergedData`, keeping the **first non-empty value** per key (ideal when Screenshot 1 captures Job/Print Settings and Screenshot 2 captures Ink Consumption at the bottom of Mimaki RasterLink).
- If some images succeed and others fail, displays an alert listing failed image indices and opens `#ocrReviewModal` with the merged data. If all images fail, alerts and reloads the page (`location.reload()`).
- On successful save, all consumed card IDs (comma-joined in `#review_fcard_id`) are removed from the preview dock.

## 3. Four-Mode Review Modal (`#ocrReviewModal`)

`openRecordModal(data, mode)` reuses a single modal form (`#ocrReviewForm`) across four operational modes:

| Mode | Modal Title | `fno` Submitted | Field Editability | Save Button | Special Initialization Behavior |
| :--- | :--- | :---: | :--- | :---: | :--- |
| `'add'` | **Add Data** | `0` | Editable | Visible | Pre-fills today's date, current user as PIC tag, `DPU = ""`, `Angle = 1`, and loaded IE cycle-time defaults |
| `'review'` | **Review Captured Data** | `0` | Editable | Visible | Sets `DPU = "No"`, stores raw OCR ink values in `data-base-val`, scales by `Angle`, triggers `Part No` auto-fill if needed, stores `cardId` list for post-save cleanup |
| `'edit'` | **Edit Record** | **`0`** *(append-only!)* | Editable | Visible | Unscales saved ink values (`saved / angle`) into `data-base-val` so changing `Angle` scales cleanly; **inserts a new revision row** on save |
| `'detail'` | **Record Details** | Existing `fno` | Read-only (`readonly` + disabled selects/date + hidden PIC input) | Hidden | Full read-only inspection of any row |

### Smart Form Controls Inside `#ocrReviewModal`

- **30 Hidden RasterLink OCR Fields:** Preserves all 29 non-ink Mimaki RasterLink metadata/timing fields (`focr_job_name` through `focr_working_directory`) plus `fno` as hidden inputs so OCR fidelity is saved to SQL Server without cluttering the IE form.
- **Multi-Tag `PIC IE Piloting` Picker:** Supports selecting multiple engineers from `#picPilotingDropdown` (or typing custom names), rendered as removable pill tags (`renderPicPilotingTags`) serialized as comma-separated text into `#review_fpic_piloting`.
- **Keyboard-Navigable Autocomplete Dropdowns:** 13 text inputs (`Status Sample`, `Part No`, `Sculpt No`, `Molded No`, `Toy No`, `Toy Desc`, `Material Part`, `MC No`, `MC Code`, `DIJ Nest Type`, `Cleaning Process`, `Packing Type`, `Status Array`) share `renderCustomDropdown()` and `handleDropdownKeyNav()` (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`). Code fields (`Part No`, `Sculpt No`, `Molded No`, `Toy No`, `Toy Desc`, `MC No`, `MC Code`, `Nest Identification`) auto-uppercase on input.
- **Collapsible `Additional Cycle Time` Accordion (`#allowanceAccordion`):** Collapsed by default to keep the form clean; expands automatically if validation fails on any of the 4 fields inside (`Standard Allowance`, `Load/unload Nest`, `Additional Auto Cleaning`, `Additional Auto Wiping`).

### Conditional `DPU` (`Yes` / `No`) Form Behavior (`toggleDpuDependentFields`)

| `DPU` Selection | Visible & Required Fields | Hidden & Cleared (`null`) Fields |
| :--- | :--- | :--- |
| **`No`** *(Full DIJ Piloting)* | All core fields + Molded No, Material, MC No/Code, Nest Type/ID, Cycle Time group & accordion, Output per Print/Hour/FC, 11 Ink Yields, Cleaning Process, Packing Type/Info, Status Array *(6 optional: `Sculpt No`, `Angle`, `W2`, `W3`, `Clear`, `Total`)* | None |
| **`Yes`** or Blank | Core identification only: `PIC IE Piloting`, `Date`, `Status Sample`, `Part No`, `DPU`, `Toy No`, `Toy Desc` | All 31 technical, cycle-time, output, ink-yield, cleaning, packing, and status-array fields are hidden and explicitly set to `null` on submit |

## 4. 39-Column DataTable & Client-Side Excel Export

`initializeDataTable(data)` configures DataTables `1.11.5` with `scrollX: true`, `scrollY: '540px'`, page sizes `10 / 25 / 50 / 100 / All`, automatic hover `title` tooltips on every data cell (`createdRow`), and **39 columns** (`Actions` gear + `No` + 37 piloting/ink/audit columns).

### Floating Row Action Menu (`toggleActionModal`)
Clicking the vertical ellipsis (`⋮`) in column 1 portals `#actionModal_{fno}` onto `document.body` (preventing DataTables scroll clipping) with boundary-aware fixed positioning and three actions:
- **Detail** (always enabled) → `openRecordModal(row, 'detail')`
- **Edit** (shows `Edit will create new data` info tooltip; login required) → `openRecordModal(row, 'edit')`
- **Delete** (login required + `confirm()`) → `POST /OCR/Delete`

### Client-Side `Export to Excel` Transformations (`excelHtml5`)
Clicking **Export to Excel** exports all visible columns except the `Actions` column and applies two automatic transformations inside `customizeData`:
1. **Chronological Order:** Reverses rows (from newest-first UI order to oldest-first chronological order) and renumbers `No` (`1` through `N`).
2. **Ink Column Reordering:** Remaps the 11 ink yield columns from the web table's CMYK-first order (`CYAN, MAGENTA, YELLOW, BLACK, LC, LM, W1, W2, W3, Clear, Total`) into the standardized RasterLink report order matching the server EPPlus export:
   `CYAN` → `W1` → `W2` → `W3` → `LM` → `BLACK` → `YELLOW` → `MAGENTA` → `LC` → `Clear` → `Total`.

## 5. Settings Dashboard (`Views/OCR/Settings.cshtml`)

Accessible via the right-edge `isOcrSidebar` gear button (`/OCR/Settings`), `Settings.cshtml` features a fixed `270px` left navigation panel (with back arrow to `/OCR`), a sticky top action bar (**Reset to default** and **Save settings**), and three configuration tabs loaded via `GET /OCR/GetSettingsData` and persisted via `POST /OCR/SaveSettingsData`:

| Tab (`data-tab`) | Backing Table & Keys | Configurable Fields & Per-Tab Reset Defaults |
| :--- | :--- | :--- |
| **Export Piloting Report** (`network-export`) | `hdps_common_mst_exportedpath` (`fproject_name = "OCR"`, `fproject_no = 1`) | Path (`\\<file-server>\Public\HDP\HDP Studio\Exported`), File name (`AutoExport - Piloting Report.xlsx`), Worksheet (`Sheet1`), Frequency (`300s`, min `10`), Description, Active toggle (`true`) |
| **Export OEE Report** (`network-export-oee`) | `hdps_common_mst_exportedpath` (`fproject_name = "OCR"`, `fproject_no = 2`) | Path (`\\<file-server>\Public\HDP\HDP Studio\Exported`), File name (`AutoExport - OEE Report.xlsx`), Worksheet (`Sheet1`), Frequency (`300s`, min `10`), Description, Active toggle (`true`) |
| **Cycle time & output** (`cycle-time-output`) | `hdps_common_mst_setting` (`fprocess_code = "C05"`, `fproject_name = "Piloting Report"`, `fproject_no = 1..4`) | Load/unload nest (`20s`), Additional auto cleaning (`20s`), Additional auto wiping (`36s`), Standard allowance (`5%`, validated `5%–6%`) |

Clicking **Reset to default** resets only the **currently active tab** after a confirmation prompt and immediately saves all settings to SQL Server (which also reschedules `_exportTimer` live).
