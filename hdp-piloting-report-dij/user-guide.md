# HDP Piloting Report DIJ — Operator & IE Admin Guide

This guide covers daily Mimaki RasterLink OCR capture, manual piloting entry, append-only revision management, Settings configuration, and troubleshooting for **HDP Piloting Report DIJ** (`/OCR`).

## 1. Opening & Access Permissions

Launch **HDP Piloting Report DIJ** from **HDP Studio Hub → Piloting Report DIJ** (`#CACADB`), the **HDP Studio App Launcher**, **INSIDE Sidebar → Decoration → Piloting Report DIJ**, or directly via `/OCR`.

- **Without Logging In:** You can browse/search the 39-column DataTable, inspect any row via **⋮ → Detail**, and click **Export to Excel**.
- **With an INSIDE Account:** Signing in unlocks **Add data**, **Paste/Browse/Capture**, **Process OCR**, **⋮ → Edit**, and **⋮ → Delete**. Clicking any locked action automatically opens the INSIDE login modal.

## 2. Capturing Mimaki RasterLink Screenshots & Running Gemini OCR

When piloting a new DIJ part in Mimaki RasterLink:

1. **Add One or More Screenshots** using any method in the left dock:
   - **Capture out *(recommended for RasterLink)*:** Click **Capture out**, select the Mimaki RasterLink window in the browser picker, wait for the dimmed crop screen, drag a rectangle over the Properties panel, and release (press `Esc` to cancel).
   - **Paste image / `Ctrl + V`:** Take a screenshot with Windows Snipping Tool (`Win + Shift + S`) and press **`Ctrl + V`** anywhere on the page (works over both HTTP and HTTPS) or click **Paste image**.
   - **Browse image:** Select a saved `.png` / `.jpg` file from disk.
   - **Capture in:** Choose **Capture in** from the split dropdown to snip a region inside the current browser page.
   - *Multi-Screenshot Tip:* If RasterLink Properties requires scrolling (e.g., General tab + Ink Consumption at the bottom), add **both** screenshots to the queue — **Process OCR** merges non-empty fields from every card automatically.
2. **Verify Queued Previews:** Click any thumbnail card to inspect it full-screen, download it as `.png`, or remove mistaken captures with the trash icon.
3. **Click `Process OCR`:** All queued cards are analyzed concurrently by Google Gemini Vision. Once complete, the **Review Captured Data** modal opens with extracted RasterLink metadata and ink yields pre-filled and `DPU` set to **`No`**.

## 3. Reviewing, Calculating & Saving a Piloting Record

Inside **Review Captured Data** (or **Add Data** for manual entry without OCR):

1. **PIC IE Piloting & Date:** Confirm your name tag appears in **PIC IE Piloting** (add additional engineers from the dropdown if needed) and verify **Date** and **Status Sample** (`Approved`, `FEP Only`, `Other`).
2. **Enter `Part No`:** Start typing or pick from the autocomplete dropdown. `Toy No`, `Toy Desc`, and `Molded No` auto-populate automatically when a match exists in Sample Tracking QR logs, the Master Paint Part List, or prior OCR entries.
3. **Select `DPU` (`Yes` vs. `No`):**
   - Choose **`No`** for standard DIJ piloting runs (shows all technical, nest, cycle-time, ink, cleaning, and packing fields).
   - Choose **`Yes`** for DPU-only entries (hides and clears all 31 technical/ink/cycle-time fields so only identification fields are required).
4. **Enter Cycle Time, Output per Print & Angle (`DPU = No`):**
   - Enter **Cycle Time** as `mm:ss` (e.g., `01:44`) or raw seconds (`104`), enter **Output per Print** (cavity count), and set **Angle** (`1` for single-angle, `2+` for multi-angle).
   - **Output per Hour** recalculates automatically (floored to the nearest `10`), and all **10 Ink Yield channels + Total Yield** automatically scale by **Angle**.
   - Expand **Additional Cycle Time** only if you need to override the default **Standard Allowance (`5%–6%`)**, **Load/unload Nest**, **Additional Auto Cleaning**, or **Additional Auto Wiping** for this specific run.
   - Enter **Output for FC**, verify ink yields (optional channels: `W2`, `W3`, `Clear`, `Total`), and fill **Cleaning Process**, **Packing Type**, **Packing Information**, and **Status Array**.
5. **Click `Save`:** The record is appended to SQL Server, consumed capture cards are cleared, and the DataTable refreshes immediately.

## 4. Viewing, Editing (Append-Only), Deleting & Exporting

- **Inspect Full Record:** Click **⋮ → Detail** on any row to view every field read-only.
- **Edit a Record:** Click **⋮ → Edit**. Notice the info tooltip: **Edit creates a new record (`fno = 0`)** rather than overwriting the old row, preserving historical piloting trials. The scheduled OEE Report automatically picks the newest revision for each `Part No`.
- **Delete a Record:** Click **⋮ → Delete** and confirm to permanently remove an erroneous row.
- **Manual Excel Export:** Click **Export to Excel** above the table to download the filtered rows reversed into chronological order (`No = 1..N`) with ink columns reordered (`CYAN, W1, W2, W3, LM, BLACK, YELLOW, MAGENTA, LC, Clear, Total`) to match the automated server report.

## 5. Configuring Auto-Exports & Cycle-Time Defaults (`/OCR/Settings`)

Click the **Settings gear icon** on the bottom-right strip of the page:

1. **Export Piloting Report (Tab 1):** Configure the UNC output folder, filename (`AutoExport - Piloting Report.xlsx`), worksheet name, interval in seconds (`>= 10`, default `300`), description, and **Auto-export status** toggle.
2. **Export OEE Report (Tab 2):** Configure the deduplicated 6-column `XLOOKUP` OEE workbook (`AutoExport - OEE Report.xlsx`) independently.
3. **Cycle time & output (Tab 3):** Adjust default **Load/unload nest** (`20s`), **Additional auto cleaning** (`20s`), **Additional auto wiping** (`36s`), and **Standard allowance** (`5%–6%`) applied to new piloting records.
4. Click **Save settings** (applies immediately and updates the background export timer without restarting IIS), or click **Reset to default** to restore defaults for the currently selected tab.

## 6. Troubleshooting

| Symptom | Likely Cause | Resolution |
| :--- | :--- | :--- |
| **OCR fails: `"AI API Key / AI Model is not configured"`** | Missing or blank `fai_api_key` / `fai_model` in `hdps_common_mst_aiapikey` for `fproject_name = 'OCR'`, `fno_ai_api_key = 1` | Verify the latest `OCR` row in `hdps_common_mst_aiapikey` in SQL Server |
| **Capture out shows `"does not support external window capture"`** | `navigator.mediaDevices.getDisplayMedia` requires HTTPS (or `localhost`) | Access the portal via HTTPS, or take a screenshot (`Win + Shift + S`) and press **`Ctrl + V`** directly on the page |
| **Save blocked with `"Standard Allowance must be between 5% and 6%."`** | Value inside the collapsed **Additional Cycle Time** accordion is outside `5`–`6` | Enter a value between `5` and `6` (e.g., `5` or `5.5`) and save again |
| **After clicking Edit & Save, the old row is still in the table** | Expected **append-only** design (`Edit will create new data`) | Keep the history row for audit traceability, or use **⋮ → Delete** if the prior entry was an accidental duplicate |
| **Scheduled Piloting or OEE Excel file stops updating** | (1) Toggle is off in `/OCR/Settings`; (2) IIS app pool recycled while idle; (3) IIS App Pool identity lacks write permissions on the UNC folder or someone has the `.xlsx` locked open | Check toggles in `/OCR/Settings`, open `/OCR` once to wake `_exportTimer`, verify UNC write permissions, and close open Excel locks |
| **OEE Report shows `#REF!` / `#NAME?` in Columns C–E** | External workbooks (`MRP PART.xlsx` or `LIST MC HOURS DIJ for OEE calc.xlsx`) were unreachable or opened in a legacy Excel version without `XLOOKUP` | Open in Microsoft 365 / Excel 2021+ with network access to the shared drive and enable external links |
| **Save / Delete / OCR returns anti-forgery error** | Page stayed open past session/cookie expiry | Reload the page (`F5`) to refresh `__RequestVerificationToken` and retry |
