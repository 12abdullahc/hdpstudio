# HDP Locator Nest DIJ — Operator & Admin Guide

This guide covers daily shopfloor fixture lookup (no login required), authenticated slot editing for tooling administrators, slot blocking/clearing conventions, and common troubleshooting scenarios.

## 1. Opening the Application

Open **HDP Locator Nest DIJ** from any of four entry points — **no login is required to view or search**:

1. **HDP Studio Hub:** Filter by **DIJ** (or search `locator` / `nest` / `fixtures`) and click the **Locator Nest DIJ** card (`#BCD1CA`).
2. **HDP Studio Header Launcher:** Open the 9-dot app switcher and click **Locator Nest DIJ**.
3. **Legacy INSIDE Sidebar:** Under the **Decoration** menu, click **Locator Nest DIJ** (`fa-crosshairs`).
4. **Direct URL:** Navigate straight to `/LocatorNestDIJ`.

## 2. Searching for a Toy / Fixture (Operator Workflow)

The page loads in **Search** mode automatically so operators can find any fixture in seconds:

1. **Type in the Search Box:** Enter a full or partial Toy Number (case-insensitive) into the **Search** bar at the top right.
2. **Inspect Match Highlights:**
   - Every matching slot across all racks highlights in **dark crimson** (`#6b2429`).
   - The active match highlights in **bright red** (`#dc3545`) and scrolls smoothly into the horizontal center of the viewport.
   - The match navigator next to the input shows **`1 / N`** (or **`0 found`** if no slot contains the search term).
3. **Cycle Through Multiple Matches:**
   - Press **`Enter`** inside the search box, or click the **`▲` (Previous)** and **`▼` (Next)** arrows to jump cleanly across racks (wraps around automatically).
4. **Read the Physical Location:**
   - Note the colored **Nest Header** (`NEST 1`–`NEST 4`), the **Column** letter at the top of that rack, and the small **Row Sub-Index** number on the right half of the highlighted cell.
   - Hover over a long truncated Toy Number to view its full text tooltip.
5. **Clear Search:** Click the **`×`** button inside the search input (or clear the text) to remove all highlights.

### Reading Slot Colors at a Glance

| Cell Appearance | Meaning |
| :--- | :--- |
| **Dark cell with bold white text** | Occupied slot holding that Toy Number |
| **Yellow, Green, or Orange shaded cell with sub-index number** | Available open slot *(Yellow: standard zone; Green: NEST 2 rows `9–30`; Orange: NEST 3 columns `Q–T`)* |
| **Dark hatched cell with padlock icon** | Blocked / unusable slot (`BLACK`, `BLOCKED`, or `-`) |
| **Blank dark cell (no number)** | Unconfigured grid coordinate |

## 3. Editing & Managing Slots (Tooling Admin Workflow)

Updating slot records requires an authenticated INSIDE session:

1. **Enter Edit Mode:** Click **Edit** in the top-right pill toggle.
   - If you are not signed in, the **Log In (INSIDE Account)** modal opens automatically. Sign in and click **Edit** again.
   - Once active, the search input hides and hovering any slot pair highlights both the Toy Number and sub-index cell in red (`#dc3545`).
2. **Select a Slot:** Click either half of any cell (existing or blank coordinate) to open **Edit Cell Data**.
3. **Verify Location:** Check the read-only **Location** banner (`NEST X - Column Y, Row Z`) at the top of the modal.
4. **Update Fields:**
   - **Assign / Change a Toy:** Type the Toy Number in **Toy Number (`ftoy_number`)** and optionally set or keep **Column Row (`fcolumn_name_row`)**.
   - **Free / Clear a Slot:** Delete the text in **Toy Number (`ftoy_number`)** while keeping **Column Row (`fcolumn_name_row`)** populated — the slot immediately turns into an available zone-colored cell after saving.
   - **Block a Slot:** Enter **`BLACK`**, **`BLOCKED`**, or **`-`** in **Toy Number (`ftoy_number`)** — the slot renders with diagonal hatching and a padlock icon (`Blocked` tooltip).
5. **Save Changes:** Click **Save Changes**. The modal closes and all racks reload automatically from SQL Server.
6. **Return to Search Mode:** Click **Search** in the top-right toggle to exit Edit Mode and prevent accidental clicks.

> [!TIP]
> Clicking a completely empty cell (`data-fno="0"`) in Edit Mode automatically creates a brand-new row in `hdps_dij_ln_mst_locator` on save — no manual SQL `INSERT` is needed for existing columns within rows `1–30`.

## 4. Troubleshooting

| Symptom | Likely Cause | Resolution |
| :--- | :--- | :--- |
| **Clicking Edit opens the Login modal** | No active `Session["us_usrname"]` (read-only shopfloor mode is active) | Log in with a valid INSIDE account, then click **Edit** again |
| **Save fails with `"Unauthorized. Please login."`** | Session timed out while the page stayed open | Reload the page, log in via the Account menu, and retry the edit |
| **Save fails with an HTTP 500 error** | Expired anti-forgery token (`__RequestVerificationToken`) or invalid state | Reload the page (`F5`) to refresh the anti-forgery token and resubmit |
| **A newly added SQL row does not appear in the rack** | `flocator_nest_row` is `NULL`, `< 1`, or `> 30` (frontend renders rows `1..30` only), or a duplicate `(Nest, Column, Row)` exists | Verify `flocator_nest_row` is between `1` and `30` and check for duplicate coordinates using the diagnostic queries in [API & Database Schema](./api-and-database.md) |
| **A column appears on the far right instead of alphabetical order** | `GetLocatorData` sorts columns by `MIN(fno)` (insertion order), not alphabetically by `fcolumn_name` | Expected behavior — column position follows the lowest `fno` primary key in that column |
| **Search shows `"0 found"` for a known toy** | Toy number spelling differs (extra space/hyphen) or was entered in a row `> 30` | Try searching a shorter substring (e.g., the numeric portion only) |
