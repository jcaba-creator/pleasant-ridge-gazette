/**
 * The Pleasant Ridge Gazette — Telemetry & Predictive AAR Google Apps Script
 * Paste this script into your Google Sheet (Extensions -> Apps Script -> Deploy as Web App).
 * Automatically streams site engagement events and prediction fidelity audits into two tabs.
 */

function doPost(e) {
  try {
    var raw = e.postData.contents;
    var data = JSON.parse(raw);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (data.action === "predictive_aar" || data.Forecast_MinTemp_F !== undefined) {
      // Append to Prediction_AAR_Audit tab
      var sheet = getOrCreateSheet(ss, "Prediction_AAR_Audit", [
        "Date", "Forecast_MinTemp_F", "Freeze_Alert_Active",
        "Stranger_Creek_Gauge_Ft", "Easton_Bridges_Status",
        "USD449_Status", "Fort_Status", "KDOT_Incidents",
        "Model_Outcome", "Fidelity_Score", "Logged_At"
      ]);
      sheet.appendRow([
        data.date || new Date().toLocaleDateString(),
        data.forecast_min_temp || data.Forecast_MinTemp_F || "",
        data.freeze_alert || data.Freeze_Alert_Active || "",
        data.stranger_creek || data.Stranger_Creek_Gauge_Ft || "",
        data.easton_bridges || data.Easton_Bridges_Status || "CLEAR",
        data.usd449_status || data.USD449_Status || "Normal",
        data.fort_status || data.Fort_Leavenworth_Status || "Normal",
        data.kdot_incidents || data.KDOT_Corridor_Incidents || 0,
        data.model_outcome || data.Model_Outcome || "Model Win",
        data.fidelity_score || data.Fidelity_Score_Pct || "100%",
        new Date()
      ]);
    } else {
      // Append to Site_Engagement tab
      var sheet = getOrCreateSheet(ss, "Site_Engagement", [
        "Timestamp", "Date", "Event", "Device", "Screen", "City", "Detail"
      ]);
      sheet.appendRow([
        new Date(),
        new Date().toLocaleDateString(),
        data.event || "pageview",
        data.device || "Desktop",
        data.extra?.viewport || data.screen || "",
        data.geo_city || "Easton Area",
        data.extra?.detail || data.target_detail || ""
      ]);
    }

    return ContentService.createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ result: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e2e8f0");
  }
  return sheet;
}
