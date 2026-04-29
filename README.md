# Temperature Logging Checklist

Static GitHub Pages checklist for daily temperature, humidity, differential pressure, refrigerator, freezer, and eyewash documentation.

## Files

- `index.html`, `styles.css`, `app.js`: the GitHub Pages app.
- `scriptstation-logo.svg`: ScriptStation logo asset used in the app header.
- `google-apps-script.gs`: Google Apps Script backend for Google Sheets, Slack reminders, and weekly exports.
- Source `.docx` files: original paper forms used to define checklist fields and ranges.

## Frontend Features

- Required employee, initials, documented day/date, physical completion time, submitted date, acceptable response, result, and notes where applicable.
- Automatic WNL/out-of-spec checks:
  - Temperature/humidity for Front Hallway, Tablet Room, Capsule Room, Back Hallway, Base Storage, Fulfillment Area, Non-HD Lab, Packing Area, HD Lab, and Receiving Area.
  - Room temperature: 68°F-77°F
  - Humidity: less than 60%
  - Differential pressure: one daily location with separate AM and PM entries, -0.03 to -0.01 in H2O
  - Refrigerator checks for Non-HD Lab Fridge, HD Lab Fridge, and Receiving Fridge: 36°F-46°F
  - Freezer check for Non-HD Lab Freezer: -13°F to 14°F
  - Eyewash checks for Non-HD Lab and HD Lab: pathway clear, station unobstructed, clear water flow, no leaks, unexpired
- In-process save path for out-of-spec entries, with required supervisor notification acknowledgement.
- N/A day option with required comment.
- Required note when the submitted date differs from the documented work date.
- Include controls to include all logs, clear all logs, or submit PM differential pressure by itself.
- Dashboard filters for date range, location, status, log type, and employee.
- Dashboard trend graph for numeric readings, with filters for location, log type, status, date range, employee, and metric.
- Google Sheet writes to a master raw-entry tab and separate location tabs for easier review.

## Google Sheet and Apps Script Setup

1. Create a new Google Sheet.
2. Open `Extensions > Apps Script`.
3. Paste the contents of `google-apps-script.gs`.
4. In Apps Script, open `Project Settings > Script properties` and add:
   - `SPREADSHEET_ID`: the ID from the Google Sheet URL.
   - `SLACK_WEBHOOK_URL`: the new Slack incoming webhook URL.
   - `EXPORT_EMAIL`: optional email address for weekly CSV exports.
5. Run `setupTemperatureLogging()` once from Apps Script and approve permissions.
   - This creates the master tab plus location tabs for temperature/humidity, pressure, refrigerator, freezer, and eyewash records.
   - If the master tab already has entries, run `rebuildLocationTabs()` once to backfill the location tabs.
6. Deploy as a web app:
   - Execute as: `Me`
   - Who has access: `Anyone`
7. Copy the deployed web app URL.
8. Open the checklist, go to `Settings`, paste the web app URL, and send a test ping.

## GitHub Pages Setup

1. Create a new GitHub repository.
2. Upload `index.html`, `styles.css`, `app.js`, and this `README.md`.
3. In GitHub, open `Settings > Pages`.
4. Set the source to the main branch root.
5. Open the published Pages URL and configure the Apps Script endpoint in `Settings`.

## Automation

The Apps Script setup creates three time-based triggers:

- `sendAmReminder`: daily AM Slack reminder.
- `sendPmIncompleteReminder`: daily PM Slack reminder if today has no Complete or N/A entry.
- `sendWeeklyExport`: Sunday evening CSV export to Google Drive, optional email, and Slack notification.

Adjust reminder times by editing `setupTemperatureLogging()` before running it, or edit the triggers in Apps Script after setup.
