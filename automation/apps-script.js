/**
 * Hayl — Google Apps Script booking webhook (starter).
 *
 * Deploy: Extensions > Apps Script > paste this > Deploy > New deployment >
 * "Web app" > execute as Me, access "Anyone". Copy the /exec URL into
 * BOOKING_WEBHOOK_URL at the top of Fe/app.js.
 *
 * The site sends the booking as a JSON string with Content-Type text/plain
 * (avoids the CORS preflight Apps Script can't handle), so we parse it here.
 */
function doPost(e) {
  const booking = JSON.parse(e.postData.contents);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Bookings")
    || SpreadsheetApp.getActiveSpreadsheet().insertSheet("Bookings");

  // Header row on first use so the sheet is readable without setup.
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Submitted At", "Name", "Guests", "Time", "Email"]);
  }

  sheet.appendRow([
    booking.submittedAt,
    booking.name,
    booking.guests,
    booking.time,
    booking.email,
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
