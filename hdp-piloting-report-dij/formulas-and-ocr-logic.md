# HDP Piloting Report DIJ — Cycle Time, Ink Math & OCR Logic

This chapter documents the exact Industrial Engineering (IE) calculations, multi-angle ink yield scaling rules, and Google Gemini Vision OCR extraction pipeline implemented across `Views/OCR/Index.cshtml` and `Controllers/OCRController.cs`.

## 1. Cycle Time Formatting & Parsing (`mm:ss` ↔ Seconds)

All four time inputs (`Cycle Time`, `Load/unload Nest`, `Additional Auto Cleaning`, `Additional Auto Wiping`) are stored in SQL Server as **numeric seconds** (`double?`), but edited and displayed in the UI and Piloting Excel export as **`mm:ss`**:

- **`parseCycleTime(val)` (UI → Seconds):**
  - If input contains `:` (`"m:s"`): returns `(parseFloat(m) || 0) * 60 + (parseFloat(s) || 0)`.
  - Otherwise: parses raw numeric seconds directly (`parseFloat(val)`), returning `null` if empty or `NaN`.
- **`formatCycleTime(val)` (Seconds → `mm:ss`):**
  - Splits raw seconds into `mins = Math.floor(totalSec / 60)` and `secs = Math.round(totalSec % 60)`.
  - Normalizes carry-over when `secs >= 60` (`mins += Math.floor(secs / 60); secs %= 60`), zero-padding both parts to 2 digits (e.g., `96` → `"01:36"`, `20` → `"00:20"`, empty → `"00:00"`).

## 2. Output per Hour Calculation (`calculateOutputPerHour`)

Whenever `Cycle Time`, `Output per Print`, `Angle`, or any of the 4 `Additional Cycle Time` accordion fields changes, `calculateOutputPerHour()` computes the hourly output using IE standard-allowance math:

### Equations

```text
TotalCycleTime (sec) = fcycle_time + fload_unload_nest + fadditional_auto_cleaning + fadditional_auto_wiping
BaseOutput (pcs/hr)  = (3600 / TotalCycleTime) * foutput_per_print
RawOPH (pcs/hr)      = (BaseOutput * (1 - fstandard_allowance / 100)) / fangle
OutputPerHour        = Math.Floor(RawOPH / 10) * 10
```

### Parameter Constraints & Defaults

| Parameter | Field Name | Default (from `/OCR/Settings`) | Validation / Clamp Rule |
| :--- | :--- | :---: | :--- |
| Print Cycle Time | `fcycle_time` | `00:00` (`0s`) | Must yield `TotalCycleTime > 0` |
| Load/unload Nest | `fload_unload_nest` | `20s` (`00:20`) | Required when `DPU = No` |
| Additional Auto Cleaning | `fadditional_auto_cleaning` | `20s` (`00:20`) | Required when `DPU = No` |
| Additional Auto Wiping | `fadditional_auto_wiping` | `36s` (`00:36`) | Required when `DPU = No` |
| Standard Allowance (%) | `fstandard_allowance` | `5%` | Strictly validated `5% <= SA <= 6%` (clamped on server in `SaveSettingsData`) |
| Output per Print (cavity qty) | `foutput_per_print` | *(required)* | Must be `> 0` |
| Angle (print passes/orientations) | `fangle` | `1` | Values `< 1` or blank default to `1` |

> [!NOTE]
> **4-Point Floor-to-10 Consistency:** Flooring `foutput_per_hour` to the nearest `10` (`Math.Floor(val / 10) * 10`) is enforced in four places: `calculateOutputPerHour()`, `submitOcrData()`, `OCRController.SaveOcrData()`, and both DataTable rendering and server-side EPPlus Piloting export.

### Worked Example

Suppose an IE engineer pilots a DIJ part with:
- Print Cycle Time = `01:44` (`104s`), default Load/Unload (`20s`), Auto Cleaning (`20s`), Auto Wiping (`36s`)
- Output per Print = `24` cavities, Standard Allowance = `5%`, Angle = `2` (two-angle print)

1. `TotalCycleTime = 104 + 20 + 20 + 36 = 180 s`
2. `BaseOutput = (3600 / 180) × 24 = 20 × 24 = 480 pcs/hr`
3. `RawOPH = (480 × 0.95) / 2 = 456 / 2 = 228 pcs/hr`
4. `OutputPerHour = floor(228 / 10) × 10 =` **`220` pcs/hr**

## 3. Multi-Angle Ink Yield Scaling (`calculateInkYields` & `recalculateInkTotal`)

Because a Mimaki RasterLink screenshot reports ink consumption for a **single print orientation (angle = 1)**, printing a toy across multiple angles multiplies total ink consumption per toy proportionally:

1. **Base Value Tracking (`data-base-val`):**
   - In **`review` mode** (fresh Gemini OCR output), each of the 10 individual ink channels (`cyan`, `magenta`, `yellow`, `black`, `light_cyan`, `light_magenta`, `white`, `white2`, `white3`, `clear`) plus `total` stores the raw single-angle OCR value in `$(el).data('base-val')`.
   - In **`edit` / `detail` modes**, SQL Server already stores the **angle-multiplied** value, so `openRecordModal()` recovers the single-angle base via `Math.round((savedVal / angle) * 1000) / 1000`.
2. **Changing `Angle` (`calculateInkYields`):**
   - Recomputes every non-empty ink channel as `Math.round(baseVal * angle * 1000) / 1000` (3-decimal precision) and updates `Total Yield` identically (or sums the scaled channels if `total` has no base value).
3. **Manually Editing an Ink Field (`recalculateInkTotal`):**
   - Sums all 10 individual channels rounded to 3 decimals, writes the sum to `#review_focr_color_total`, and updates `total`'s `data-base-val` to `Math.round((roundedSum / angle) * 1000) / 1000` so subsequent `Angle` adjustments remain mathematically consistent.

## 4. Google Gemini Vision 40-Field OCR Pipeline (`ProcessOcrGemini`)

When `POST /OCR/ProcessOcrGemini` receives a Base64-encoded PNG screenshot:

1. **Dynamic Model & Key Lookup:** Queries `hdps_common_mst_aiapikey` for `fproject_name == "OCR" && fno_ai_api_key == 1`, ordered descending by `fno` (newest row wins).
2. **REST Request:** Sends a `POST` JSON payload via static `_httpClient` to:
   `https://generativelanguage.googleapis.com/v1beta/models/{AIModelName}:generateContent`
   containing the structured prompt and `inline_data` (`mime_type: "image/png"`, `data: base64Image`).
3. **40-Field Extraction Contract:** The prompt instructs Gemini to return raw JSON (no markdown fences or explanation) with numeric-only ink consumption values across **40 exact column names**:
   - **Job & File Metadata (10):** `focr_job_name`, `focr_file_name`, `focr_format`, `focr_image_size`, `focr_pages`, `focr_page_size`, `focr_favorite_spool_settings`, `focr_job_attribute`, `focr_use_special_color_names`, `focr_color_adjustment_set`
   - **Print Profile & Quality Settings (11):** `focr_media`, `focr_resolution`, `focr_input_profile_icc`, `focr_profile_name`, `focr_number_of_overprints`, `focr_pass`, `focr_fast_print`, `focr_print_direction`, `focr_special_color_over_print`, `focr_edge_optimizer`, `focr_ink_saving`
   - **Ink Consumption Channels (11 `double?`):** `focr_color_cyan`, `focr_color_magenta`, `focr_color_yellow`, `focr_color_black`, `focr_color_light_cyan`, `focr_color_light_magenta`, `focr_color_white`, `focr_color_white2`, `focr_color_white3`, `focr_color_clear`, `focr_color_total`
   - **Timings, Dates & Paths (8):** `focr_time_spool`, `focr_time_rip`, `focr_time_print`, `focr_file_size_ripped_data`, `focr_date`, `focr_last_print_date`, `focr_last_cut_date`, `focr_working_directory`
4. **Response Sanitization & Numeric Parsing:**
   - Extracts `candidates[0].content.parts[0].text` via `ExtractGeminiText()`.
   - Strips leading/trailing ```` ```json ```` / ```` ``` ```` markdown fences if Gemini includes them despite the prompt.
   - Parses the 11 ink values with `Regex.Replace(val, @"[^\d.-]", "")` and `double.TryParse(..., CultureInfo.InvariantCulture)` so units like `"0.50 cc"` or `"1.25 ml"` cleanly become `0.5` / `1.25`.
   - Returns `{ success: true, data, rawText, confidence: 0.95 }`.

## 5. Append-Only Revisions & OEE Report Deduplication

- **Append-Only Writes:** Both `openRecordModal(..., 'edit')` and `SaveOcrData` reset `fno = 0` so edits create new rows with fresh `fcreated_at` / `fcreated_by` metadata (`fupdated_at = null`, `fupdated_by = null`).
- **Latest-Revision Resolution in OEE Export:** Because multiple piloting revisions can share the same `fpart_no`, `ExportOeeDataToNetworkPathStatic` orders descending by `fno`, groups by `fpart_no.Trim()` (case-insensitive), selects `g.First()` (the newest revision), and re-sorts ascending by `fno` before generating the 6-column OEE workbook.

## Next Step

Inspect all 20 `OCRController` endpoints, the custom AJAX CSRF attribute, and both EPPlus auto-export schemas in [API & Auto-Export Reference](./api-and-auto-export.md).
