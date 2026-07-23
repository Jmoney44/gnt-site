/* ==========================================================================
   GLOBAL NETWORK TRANSIT — Apps Script backend for the shipment sheet
   Bound to: GNT Shipment Tracking (the Google Sheet)

   WHAT THIS DOES
   - doPost(e)  → website "Request Shipment" form calls this. It generates
                  a new tracking number, appends a row to the sheet with
                  Status = "Picked Up", and returns the tracking number.
   - doGet(e)   → website tracking page calls this with ?id=GNT-xxxx-CN.
                  It looks up that row live (no cache delay) and returns it
                  as JSON.

   SETUP
   1. Open the Google Sheet → Extensions → Apps Script.
   2. Delete any starter code, paste this whole file in.
   3. Check SHEET_NAME below matches your tab name (bottom tab, usually
      "Sheet1" — rename if you like, just keep this constant matching it).
   4. Click Deploy → New deployment → gear icon → Web app.
        - Execute as: Me
        - Who has access: Anyone
   5. Click Deploy, authorize when prompted, then copy the "Web app URL".
      It looks like:
      https://script.google.com/macros/s/AKfycb.../exec
   6. Paste that URL into APPS_SCRIPT_URL in js/tracking.js and in the
      request-shipment.html form script.

   NOTE: Any time you edit this code after the first deploy, you must go
   to Deploy → Manage deployments → edit (pencil) → New version → Deploy,
   or your site keeps hitting the old code.
   ========================================================================== */

const SHEET_NAME = "Sheet1";

const HEADERS = [
  "TrackingNumber","Reference","ServiceType","Status","Destination",
  "DestLat","DestLng","OriginLabel","OriginLat","OriginLng",
  "CurrentLabel","CurrentLat","CurrentLng","EstimatedDelivery","LastUpdated","Note"
];

function getSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function generateTrackingNumber_(sheet) {
  const existing = new Set(sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), 1)
    .getValues().flat().map(v => String(v).trim().toUpperCase()));
  let id;
  do {
    const digits = Math.floor(1000000 + Math.random() * 8999999);
    id = "GNT-" + digits + "-CN";
  } while (existing.has(id));
  return id;
}

/* ---- Website "Request Shipment" form submits here ---- */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = getSheet_();

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
    }

    const trackingNumber = generateTrackingNumber_(sheet);
    const today = Utilities.formatDate(new Date(), "GMT", "yyyy-MM-dd");

    const row = [
      trackingNumber,
      data.reference || "",
      data.serviceType || "",
      "Picked Up",
      data.destination || "",
      data.destLat || "",
      data.destLng || "",
      data.originLabel || "",
      data.originLat || "",
      data.originLng || "",
      data.originLabel || "",   // current starts equal to origin
      data.originLat || "",
      data.originLng || "",
      data.eta || "",
      today,
      data.note || ""
    ];

    sheet.appendRow(row);

    return jsonOut_({ success: true, trackingNumber: trackingNumber });

  } catch (err) {
    return jsonOut_({ success: false, error: String(err) });
  }
}

/* ---- Website tracking page reads a single shipment here ---- */
function doGet(e) {
  const id = e.parameter.id;
  if (!id) {
    return jsonOut_({ success: false, error: "Missing id parameter" });
  }

  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return jsonOut_({ success: false, error: "Not found" });
  }

  const headers = values[0];
  const target = id.trim().toUpperCase();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim().toUpperCase() === target) {
      const shipment = {};
      headers.forEach((h, idx) => { shipment[h] = values[i][idx]; });
      return jsonOut_({ success: true, shipment: shipment });
    }
  }

  return jsonOut_({ success: false, error: "Not found" });
}
