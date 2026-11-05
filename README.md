# Site Photo Checklist Builder

A small web app that builds a **fillable PDF photo checklist** for a site, based on how the site is configured.

1. Enter the site details (optional – they can also be typed into the PDF later).
2. Pick the site configuration: **Mount Type, Antenna Type, Secondary Antenna Type, Grounding Type, Equipment Type** (more than one can be picked in each group).
3. Click **Generate fillable PDF**.

The PDF always includes the **General** items (column G of the spreadsheet), followed by one section for each option picked. Every item has a **Done** checkbox, an **N/A** checkbox and a **Notes** field, and the PDF ends with a general-notes box.

It is a plain static site (HTML/CSS/JavaScript) – no server, no build step, no internet connection needed once loaded. The PDF is created in the browser with [pdf-lib](https://pdf-lib.js.org/), which is included in `vendor/`.

## Putting it on GitHub

1. Create a new repository on GitHub (e.g. `photo-checklist`).
2. Upload the contents of this folder (drag and drop on the repository page, or `git push`).
3. To host it: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, choose `main` and `/ (root)`, then **Save**.
4. After a minute the app is live at `https://<your-account>.github.io/photo-checklist/`.

To use it without hosting, download the folder and open `index.html` in a browser.

## Updating the checklist items

All items come from `data/Photo_Checklist_Build_Out.xlsx`, laid out as:

| Columns | Meaning |
|---|---|
| A – E | Selection groups (header in row 1, options below) |
| G | Generic items – always included |
| H – AD | One column per option; the header must match the option name in A – E |

After editing the spreadsheet, regenerate the data file and commit both:

```bash
pip install openpyxl
python scripts/build_data.py
```

This rewrites `js/checklist-data.js`. The script prints a warning if an option in A – E has no matching column in H – AD (or the reverse). A column header may add a suffix to the option name – e.g. option `HG72710LP` matches column `HG72710LP (LTE)`.

To add a new option: add it to the right group in A – E, add a new column (anywhere after G) with the same name as its header and its items below, then re-run the script.

## Project layout

```
index.html               App page
css/style.css            Styles
js/app.js                Selection UI and checklist logic
js/pdf.js                Fillable PDF generator
js/checklist-data.js     Checklist data (generated from the spreadsheet)
data/                    Source spreadsheet
scripts/build_data.py    Spreadsheet -> js/checklist-data.js
vendor/pdf-lib.min.js    pdf-lib 1.17.1 (MIT licence)
```

## PDF field names

Fields are named predictably, in case the filled PDFs are ever processed automatically:

- Header: `Site_Name`, `Site_ID`, `Date`
- Items: `S<section#>_<Section_Name>_I<item#>_Done` / `_NA` / `_Notes` – e.g. `S02_Collared_Wall_Mount_I03_Done`
- End: `General_Notes`

## Notes

- Selections and site details are remembered in the browser (local storage) for convenience. **Start new form** (top right) clears everything; **Clear selections** resets only the picks.
- The downloaded PDF is named `<Site ID> <date created>.pdf`, e.g. `JOB-1234 2026-11-05.pdf` (or `Photo Checklist <date>.pdf` if no site ID is entered).
- Photo capture is intentionally not included yet.
