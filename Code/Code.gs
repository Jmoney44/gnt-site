/* ==========================================================================
   GLOBAL NETWORK TRANSIT — Apps Script backend for the shipment sheet
   Bound to: GNT Shipment Tracking (the Google Sheet)

   ENDPOINTS
   - GET  ?id=GNT-xxxx-CN
         Public. Used by tracking.html. Returns one shipment.

   - GET  ?action=list&password=YOUR_PASSWORD
         Admin only. Used by admin.html. Returns every shipment row.

   - POST { ...shipment fields... }                (no "action" key)
         Public. Used by request-shipment.html. Creates a new row,
         generates a tracking number, status starts as "Picked Up".

   - POST { action:"updateStatus", password:"...", trackingNumber:"...",
            status:"...", currentLabel, currentLat, currentLng, note }
         Admin only. Used by admin.html. Updates an existing row.

   SETUP
   1. Change ADMIN_PASSWORD below to something only you and your staff know.
   2. Open the Google Sheet → Extensions → Apps Script, paste this whole
      file in, replacing what's there.
   3. Deploy → Manage deployments → pencil icon → New version → Deploy.
      (If this is your very first deploy: Deploy → New deployment → Web
      app → Execute as Me → Who has access Anyone → Deploy → authorize.)
   4. The Web app URL stays the same across "new version" deploys, so you
      do NOT need to update js/tracking.js, request-shipment.html, or
      admin.html when you only edit this file — just redeploy a new
      version after saving changes here.
   ========================================================================== */

const SHEET_NAME = "Sheet1";
const ADMIN_PASSWORD = "CHANGE_ME_TO_A_REAL_PASSWORD";

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

/* ---- GET: single lookup (public) or full list (admin) ---- */
function doGet(e) {
  const sheet = getSheet_();

  if (e.parameter.action === "list") {
    if (e.parameter.password !== ADMIN_PASSWORD) {
      return jsonOut_({ success: false, error: "Unauthorized" });
    }
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return jsonOut_({ success: true, shipments: [] });

    const headers = values[0];
    const shipments = [];
    for (let i = 1; i < values.length; i++) {
      if (!values[i][0]) continue;
      const row = {};
      headers.forEach((h, idx) => { row[h] = values[i][idx]; });
      shipments.push(row);
    }
    // Most recently added first
    shipments.reverse();
    return jsonOut_({ success: true, shipments: shipments });
  }

  const id = e.parameter.id;
  if (!id) {
    return jsonOut_({ success: false, error: "Missing id parameter" });
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonOut_({ success: false, error: "Not found" });

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

/* ---- POST: create shipment (public) or update status (admin) ---- */
function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ success: false, error: "Invalid JSON" });
  }

  if (data.action === "updateStatus") {
    return handleUpdateStatus_(data);
  }
  return handleCreateShipment_(data);
}

function handleCreateShipment_(data) {
  try {
    const sheet = getSheet_();
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);

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
      data.originLabel || "",
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

function handleUpdateStatus_(data) {
  if (data.password !== ADMIN_PASSWORD) {
    return jsonOut_({ success: false, error: "Unauthorized" });
  }
  if (!data.trackingNumber) {
    return jsonOut_({ success: false, error: "Missing trackingNumber" });
  }

  try {
    const sheet = getSheet_();
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const target = String(data.trackingNumber).trim().toUpperCase();

    const colIndex = {};
    headers.forEach((h, idx) => { colIndex[h] = idx; });

    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim().toUpperCase() === target) {
        const rowNum = i + 1; // 1-indexed sheet row

        if (data.status !== undefined) {
          sheet.getRange(rowNum, colIndex["Status"] + 1).setValue(data.status);
        }
        if (data.currentLabel !== undefined) {
          sheet.getRange(rowNum, colIndex["CurrentLabel"] + 1).setValue(data.currentLabel);
        }
        if (data.currentLat !== undefined && data.currentLat !== "") {
          sheet.getRange(rowNum, colIndex["CurrentLat"] + 1).setValue(data.currentLat);
        }
        if (data.currentLng !== undefined && data.currentLng !== "") {
          sheet.getRange(rowNum, colIndex["CurrentLng"] + 1).setValue(data.currentLng);
        }
        if (data.note !== undefined) {
          sheet.getRange(rowNum, colIndex["Note"] + 1).setValue(data.note);
        }
        if (data.eta !== undefined) {
          sheet.getRange(rowNum, colIndex["EstimatedDelivery"] + 1).setValue(data.eta);
        }

        const today = Utilities.formatDate(new Date(), "GMT", "yyyy-MM-dd");
        sheet.getRange(rowNum, colIndex["LastUpdated"] + 1).setValue(today);

        return jsonOut_({ success: true });
      }
    }
    return jsonOut_({ success: false, error: "Tracking number not found" });
  } catch (err) {
    return jsonOut_({ success: false, error: String(err) });
  }
}
