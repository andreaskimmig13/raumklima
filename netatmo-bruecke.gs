/**
 * Raumklima-Logbuch – Netatmo-Brücke (Google Apps Script)
 *
 * Holt die Messwerte deiner Netatmo-Wetterstation und gibt sie an das
 * Raumklima-Logbuch weiter. Der Netatmo-Zugang bleibt in deinem Google-Konto.
 *
 * Einrichtung (Kurzfassung, ausführlich in NETATMO.md):
 *  1. Unten bei EINRICHTUNG die vier Werte eintragen.
 *  2. Oben im Editor die Funktion „einrichten“ auswählen und auf „Ausführen“ klicken.
 *     Beim ersten Mal fragt Google nach Berechtigungen, die bestätigen.
 *     Im Protokoll muss „Zugang funktioniert“ stehen.
 *  3. Die vier Werte unten wieder löschen (sie sind jetzt sicher gespeichert) und speichern.
 *  4. „Bereitstellen“ → „Neue Bereitstellung“ → Typ „Web-App“,
 *     „Ausführen als: Ich“, „Zugriff: Jeder“ → Bereitstellen → Web-App-URL kopieren.
 *  5. URL und deinen SCHLUESSEL in der App unter Einstellungen → Netatmo eintragen.
 */

var EINRICHTUNG = {
  CLIENT_ID: '',      // von dev.netatmo.com → deine App → client ID
  CLIENT_SECRET: '',  // von dev.netatmo.com → deine App → client secret
  REFRESH_TOKEN: '',  // von dev.netatmo.com → Token generator, Scope „read_station“
  SCHLUESSEL: ''      // frei ausgedachtes Passwort, z. B. 20 zufällige Zeichen
};

function einrichten() {
  var p = PropertiesService.getScriptProperties();
  if (EINRICHTUNG.CLIENT_ID) p.setProperty('CLIENT_ID', EINRICHTUNG.CLIENT_ID.trim());
  if (EINRICHTUNG.CLIENT_SECRET) p.setProperty('CLIENT_SECRET', EINRICHTUNG.CLIENT_SECRET.trim());
  if (EINRICHTUNG.REFRESH_TOKEN) { p.setProperty('REFRESH', EINRICHTUNG.REFRESH_TOKEN.trim()); p.deleteProperty('ACCESS'); }
  if (EINRICHTUNG.SCHLUESSEL) p.setProperty('KEY', EINRICHTUNG.SCHLUESSEL.trim());
  ['CLIENT_ID', 'CLIENT_SECRET', 'REFRESH', 'KEY'].forEach(function (k) {
    if (!p.getProperty(k)) throw new Error('Es fehlt noch: ' + k + '. Bitte bei EINRICHTUNG eintragen.');
  });
  token_(true);
  var body = api_('getstationsdata', { get_favorites: 'false' });
  var n = (body.devices || []).length;
  Logger.log('Zugang funktioniert. Gefundene Stationen: ' + n + '. Du kannst die Werte bei EINRICHTUNG jetzt wieder löschen.');
}

function doGet(e) {
  try {
    var p = PropertiesService.getScriptProperties();
    var key = (e && e.parameter && e.parameter.key) || '';
    if (!p.getProperty('KEY') || key !== p.getProperty('KEY')) return out_({ error: 'Falscher Schlüssel' });
    var days = Math.min(14, Math.max(0, parseInt((e.parameter.days || '0'), 10) || 0));
    var body = api_('getstationsdata', { get_favorites: 'false' });
    var res = { time: Date.now(), stations: [] };
    (body.devices || []).forEach(function (dev) {
      var st = { id: dev._id, name: dev.station_name || dev.home_name || 'Netatmo', indoor: [], outdoor: null, rain: null, wind: null };
      st.indoor.push(indoor_(dev._id, null, dev.module_name || 'Netatmo innen', dev.dashboard_data, dev.reachable !== false));
      (dev.modules || []).forEach(function (m) {
        var d = m.dashboard_data || {};
        var ts = d.time_utc ? d.time_utc * 1000 : null;
        if (m.type === 'NAModule1') st.outdoor = { id: m._id, name: m.module_name, t: num_(d.Temperature), h: num_(d.Humidity), ts: ts, battery: m.battery_percent, reachable: m.reachable !== false };
        else if (m.type === 'NAModule2') st.wind = { id: m._id, strength: num_(d.WindStrength), angle: num_(d.WindAngle), gust: num_(d.GustStrength), gustAngle: num_(d.GustAngle), ts: ts, battery: m.battery_percent };
        else if (m.type === 'NAModule3') st.rain = { id: m._id, now: num_(d.Rain), h1: num_(d.sum_rain_1), h24: num_(d.sum_rain_24), ts: ts, battery: m.battery_percent };
        else if (m.type === 'NAModule4') st.indoor.push(indoor_(dev._id, m._id, m.module_name || 'Innenmodul', d, m.reachable !== false, m.battery_percent));
      });
      if (days) {
        var begin = Math.floor(Date.now() / 1000) - days * 86400;
        st.indoor.forEach(function (ind) {
          ind.history = measure_(dev._id, ind.module, 'temperature,humidity,co2', begin);
        });
        if (st.outdoor) st.outdoor.history = measure_(dev._id, st.outdoor.id, 'temperature,humidity', begin);
        if (st.wind) st.wind.history = measure_(dev._id, st.wind.id, 'windstrength,guststrength,windangle', begin);
        if (st.rain) st.rain.history = measure_(dev._id, st.rain.id, 'sum_rain', begin, '1hour');
      }
      res.stations.push(st);
    });
    return out_(res);
  } catch (err) {
    return out_({ error: String((err && err.message) || err) });
  }
}

function indoor_(devId, modId, name, d, reachable, battery) {
  d = d || {};
  return { id: modId || devId, module: modId, name: name, t: num_(d.Temperature), h: num_(d.Humidity), co2: num_(d.CO2),
    noise: num_(d.Noise), pressure: num_(d.Pressure), ts: d.time_utc ? d.time_utc * 1000 : null, reachable: reachable, battery: battery == null ? null : battery };
}

function measure_(devId, modId, types, begin, scale) {
  var params = { device_id: devId, scale: scale || '30min', type: types, date_begin: String(begin), optimize: 'false', real_time: 'false' };
  if (modId) params.module_id = modId;
  try {
    var body = api_('getmeasure', params) || {};
    var out = [];
    Object.keys(body).sort().forEach(function (ts) { var v = body[ts]; out.push([parseInt(ts, 10) * 1000].concat(v)); });
    return out;
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

function api_(path, params) {
  var qs = Object.keys(params).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
  var url = 'https://api.netatmo.com/api/' + path + '?' + qs;
  var t = token_(false);
  var r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + t }, muteHttpExceptions: true });
  if (r.getResponseCode() === 401 || r.getResponseCode() === 403) {
    t = token_(true);
    r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + t }, muteHttpExceptions: true });
  }
  if (r.getResponseCode() !== 200) throw new Error('Netatmo antwortet mit ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
  return JSON.parse(r.getContentText()).body;
}

function token_(force) {
  var p = PropertiesService.getScriptProperties();
  var acc = p.getProperty('ACCESS'), exp = parseInt(p.getProperty('EXP') || '0', 10);
  if (!force && acc && Date.now() < exp - 120000) return acc;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    acc = p.getProperty('ACCESS'); exp = parseInt(p.getProperty('EXP') || '0', 10);
    if (!force && acc && Date.now() < exp - 120000) return acc;
    var r = UrlFetchApp.fetch('https://api.netatmo.com/oauth2/token', {
      method: 'post', muteHttpExceptions: true,
      payload: { grant_type: 'refresh_token', refresh_token: p.getProperty('REFRESH'), client_id: p.getProperty('CLIENT_ID'), client_secret: p.getProperty('CLIENT_SECRET') }
    });
    if (r.getResponseCode() !== 200) throw new Error('Netatmo-Anmeldung fehlgeschlagen (' + r.getResponseCode() + '). Ggf. im Token generator einen neuen Refresh-Token erzeugen und einrichten() erneut ausführen. ' + r.getContentText().slice(0, 200));
    var j = JSON.parse(r.getContentText());
    p.setProperties({ ACCESS: j.access_token, REFRESH: j.refresh_token || p.getProperty('REFRESH'), EXP: String(Date.now() + (j.expires_in || 10800) * 1000) });
    return j.access_token;
  } finally {
    lock.releaseLock();
  }
}

function num_(v) { return (v === undefined || v === null || isNaN(v)) ? null : Number(v); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
