# HDP Piloting Report DIJ — API & Auto-Export Reference

All 20 controller actions, the custom AJAX anti-forgery filter (`ValidateAntiForgeryTokenAjaxAttribute`), and both scheduled EPPlus Excel exporters reside in `Controllers/OCRController.cs` (namespace `LoginAndRegisterMVCMD5.Controllers`).

## 1. Endpoint Summary Matrix (20 Actions)

### Views & Data Endpoints (`GET`)

| Method | Route | Source Table(s) | Purpose |
| :---: | :--- | :--- | :--- |
| `GET` | `/OCR` *(or `/Index`)* | `pd_user` (display name) | Sets `ViewBag.CurrentUserName` and renders `Views/OCR/Index.cshtml` |
| `GET` | `/OCR/Settings` | — | Renders 3-tab `Views/OCR/Settings.cshtml` |
| `GET` | `/OCR/GetData` | `hdps_ocr_log_rasterlinkpropertiesdataset` | Returns all piloting rows ordered descending by `fno` (`MaxJsonLength = int.MaxValue`) |
| `GET` | `/OCR/GetSettingsData` | `hdps_common_mst_exportedpath` (#1, #2), `hdps_common_mst_setting` (`C05` #1..4) | Returns both auto-export configurations and all 4 IE cycle-time settings |
| `GET` | `/OCR/GetPartNumbers` | `hdps_st_log_qrcodedata`, `hdps_common_mst_paintpartlist` | Returns distinct sorted `{ fpart_number, ftoy, fdescription, fmolded_no }` lookup list |
| `GET` | `/OCR/GetToyByPartNo?partNo={pn}` | `hdps_st_log_qrcodedata`, `hdps_common_mst_paintpartlist`, `hdps_ocr_log_rasterlinkpropertiesdataset` | 3-table fallback lookup returning `{ ftoy, fdescription, fmolded_no }` for a single Part No |
| `GET` | `/OCR/GetMoldedNumbers` | `hdps_common_mst_paintpartlist` | Distinct sorted non-blank `fmold` values |
| `GET` | `/OCR/GetToyNumbers` | `hdps_st_log_qrcodedata` | Distinct sorted non-blank `ftoy` values *(also reused for Sculpt No autocomplete)* |
| `GET` | `/OCR/GetToyDescriptions` | `hdps_st_log_qrcodedata` | Distinct sorted non-blank `fdescription` values |
| `GET` | `/OCR/GetMcNumbers` | `hdps_common_mst_machine` | Active `C05` `fmachine_name` list (`fis_active == true`) |

### Static Dropdown Catalog Endpoints (`GET`)

These 9 endpoints return `{ success: true, data: [...] }` from hardcoded C# option lists in `OCRController.cs`:

| Route | Returned Values |
| :--- | :--- |
| `/OCR/GetMcCodes` | `"DIJH (LUS 120)"`, `"DIJA (LUS120)"`, `"DIJM (LH100)"`, `"DIJB (LUS120)"`, `"DIJN (LUS 120) NEW NEST"` |
| `/OCR/GetDijNestTypes` | `"A3 X 2"`, `"A2 X 2"`, `"Other"` |
| `/OCR/GetCleaningProcesses` | `"Alcohol"`, `"Ethyl"`, `"Other"` |
| `/OCR/GetPackingTypes` | `"Blister"`, `"Polybag L"`, `"Polybag XL"`, `"Yellow Bin"`, `"Other"` |
| `/OCR/GetStatusArrays` | `"Full"`, `"Other"` |
| `/OCR/GetStatusSamples` | `"Approved"`, `"FEP Only"`, `"Other"` |
| `/OCR/GetDpuOptions` | `"Yes"`, `"No"` |
| `/OCR/GetMaterialParts` | `"Plastisol (Rotocast)"`, `"ABS (Molding)"`, `"PP (Molding)"`, `"PVC (Molding)"`, `"Other"` |
| `/OCR/GetPicPilotingOptions` | `"Fatma"`, `"Imron"`, `"Pipit"` |

### State-Mutating & AI Endpoints (`POST`, Dual CSRF)

All four `POST` actions stack `[ValidateAntiForgeryToken]` and `[ValidateAntiForgeryTokenAjax]`:

| Method | Route | Key Parameters | Purpose |
| :---: | :--- | :--- | :--- |
| `POST` | `/OCR/ProcessOcrGemini` | `base64Image` | Calls Google Gemini Vision API and returns parsed 40-field `hdps_ocr_log_rasterlinkpropertiesdataset` JSON |
| `POST` | `/OCR/SaveOcrData` | `hdps_ocr_log_rasterlinkpropertiesdataset model` | Floors `foutput_per_hour` to nearest `10`, forces `fno = 0`, stamps `fcreated_at`/`fcreated_by`, and inserts new revision row |
| `POST` | `/OCR/Delete` | `int id` | Permanently removes the matching `fno` record from `hdps_ocr_log_rasterlinkpropertiesdataset` |
| `POST` | `/OCR/SaveSettingsData` | 6 Piloting export params + 6 OEE export params + 4 IE cycle-time params | Upserts `hdps_common_mst_exportedpath` (#1, #2) and `hdps_common_mst_setting` (#1..4), clamping `standardAllowance` to `5.0..6.0`, and reschedules `_exportTimer` |

## 2. Custom `ValidateAntiForgeryTokenAjaxAttribute`

Defined at the bottom of `Controllers/OCRController.cs`, this `IAuthorizationFilter` validates the anti-forgery cookie (`AntiForgeryConfig.CookieName`) against the first available token from:
1. Header `__RequestVerificationToken`
2. Header `RequestVerificationToken`
3. Form field `__RequestVerificationToken`

If validation fails, it throws `HttpAntiForgeryException("Anti-forgery token validation failed.")`.

## 3. Key Payload Contracts

### `POST /OCR/ProcessOcrGemini`

**Request:** Form data with `base64Image` (raw Base64 string without `data:image/...;base64,` prefix) + anti-forgery token.

**Success Response:**

```json
{
  "success": true,
  "data": {
    "focr_job_name": "TOY_HEAD_A01",
    "focr_media": "LUS-120",
    "focr_resolution": "600x600",
    "focr_color_cyan": 0.42,
    "focr_color_magenta": 0.31,
    "focr_color_yellow": 0.28,
    "focr_color_black": 0.15,
    "focr_color_white": 1.85,
    "focr_color_total": 3.01,
    "focr_time_print": "01:44"
  },
  "rawText": "{ ... }",
  "confidence": 0.95
}
```

### `POST /OCR/SaveOcrData`

- Forces `model.fno = 0` (append-only insert), `model.fcreated_at = DateTime.Now`, `model.fdate ??= model.fcreated_at`, `model.fcreated_by ??= GetCurrentUserName()`, `model.fupdated_at = null`, `model.fupdated_by = null`.
- Floors `foutput_per_hour` via `Math.Floor(val / 10.0) * 10.0`.
- Captures `DbEntityValidationException` details if EF6 entity validation fails.
- **Response:** `{ "success": true }` or `{ "success": false, "message": "..." }`.

### `GET /OCR/GetSettingsData`

```json
{
  "success": true,
  "exportPath": "\\\\<file-server>\\Public\\HDP\\HDP Studio\\Exported",
  "fileName": "AutoExport - Piloting Report.xlsx",
  "sheetName": "Sheet1",
  "duration": 300,
  "exportDesc": "Automatically export data Piloting Report to excel every 5 minutes",
  "isExportActive": true,
  "oeeExportPath": "\\\\<file-server>\\Public\\HDP\\HDP Studio\\Exported",
  "oeeFileName": "AutoExport - OEE Report.xlsx",
  "oeeSheetName": "Sheet1",
  "oeeDuration": 300,
  "oeeExportDesc": "Automatically export data OEE Report to excel every 5 minutes",
  "oeeIsExportActive": true,
  "loadUnloadNest": 20,
  "autoCleaning": 20,
  "autoWiping": 36,
  "standardAllowance": 5
}
```

## 4. Dual Scheduled Network Excel Auto-Exports (`EPPlus`)

`OCRController` runs a single `static readonly System.Threading.Timer _exportTimer` initialized with a `10s` startup delay and period equal to `min(fduration)` across active `fproject_name == "OCR"` rows in `hdps_common_mst_exportedpath` (fallback `300s`). On every tick (and whenever `SaveSettingsData` saves), `_exportTimer.Change(minInterval, minInterval)` updates live and runs each active export below.

### Export #1: Piloting Report (`fproject_no = 1`)

- **Default Target:** `\\<file-server>\Public\HDP\HDP Studio\Exported\AutoExport - Piloting Report.xlsx` *(hostname sanitized)*, worksheet `Sheet1`.
- **Source Query:** All rows in `hdps_ocr_log_rasterlinkpropertiesdataset` ordered ascending by `fno`.
- **Styling:** Bold row 1 headers, `AutoFitColumns()`, `Cycle Time` formatted `mm:ss`, `Output per Hour` floored to nearest `10`.
- **38-Column Schema (A – AL):**
  1. `No` (`row - 1`), `PIC IE Piloting`, `Date` (`yyyy-MM-dd`), `Status Sample`, `Part No`, `DPU`, `Sculpt No`, `Molded No`, `Toy No`, `Toy Desc`, `Material Part`
  2. `MC No`, `MC Code`, `DIJ Nest Type`, `Nest Identification`, `Cycle Time` (`mm:ss`), `Output per Print`, `Output per Hour`, `Output for FC`
  3. **11 Reordered Ink Yield Columns:** `CYAN`, `W1 (WHITE)`, `W2 (WHITE)`, `W3 (WHITE)`, `LM (Light MAGENTA)`, `BLACK`, `YELLOW`, `MAGENTA`, `LC (Light CYAN)`, `Clear`, `Total` *(each suffixed `" Yield from Rasterlink"`)*
  4. `Cleaning Process`, `Packing Type`, `Packing Information`, `Status Array`
  5. `Created At`, `Created By`, `Last Updated At`, `Last Updated By`

### Export #2: OEE Report with External `XLOOKUP` Links (`fproject_no = 2`)

- **Default Target:** `\\<file-server>\Public\HDP\HDP Studio\Exported\AutoExport - OEE Report.xlsx` *(hostname sanitized)*, worksheet `Sheet1`.
- **Source Query:** Filters non-empty `fpart_no`, selects the **newest row (`OrderByDescending(x => x.fno)`) per trimmed `fpart_no`** (case-insensitive), then orders ascending by `fno`.
- **External Workbooks Registered via `package.Workbook.ExternalLinks.AddExternalWorkbook(...)`:**
  - `extMrp`: `\\<file-server>\Materials\Operations_Planning\Capacity East Plant\MRP\MRP PART.xlsx` (`REQ PART` sheet)
  - `extDij`: `\\<file-server>\Namlos\50. OEE EAST PLANT\05. DIJ\00. Data Support\LIST MC HOURS DIJ for OEE calc.xlsx` (`Sheet2`)
  - *(If either external workbook cannot be registered at export time, the formula falls back to embedding the full UNC path string directly.)*

| Column | Header | Value / Excel Formula | Number Format |
| :---: | :--- | :--- | :---: |
| `A` | `PN` | `item.fpart_no` | General |
| `B` | `DESC` | `item.ftoy_desc` | General |
| `C` | `MC CODE` | `XLOOKUP(A{row}, '[extMrp]REQ PART'!$C:$C, '[extMrp]REQ PART'!$N:$N)` | General |
| `D` | *(blank header)* | `XLOOKUP(A{row}, '[extDij]Sheet2'!$A:$A, '[extDij]Sheet2'!$E:$E)` | General |
| `E` | `W YIELD` | `XLOOKUP(A{row}, '[extDij]Sheet2'!$A:$A, '[extDij]Sheet2'!$V:$V)` | `0.00` |
| `F` | `W YIELD NEW` | `E{row}+(E{row}*0.2)` *(+20% yield buffer)* | `0.00` |

## Next Step

Explore the complete entity-relationship diagram and column definitions across all 8 database tables in [Database Schema](./database-schema.md).
