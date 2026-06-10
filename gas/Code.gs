/**
 * FF14 預約系統 - v8.2（含會員點數）
 *
 * 試算表分頁：
 *   - 主持人帳號表
 *   - 預約總表
 *   - 併桌團員明細
 *   - 會員名冊
 *   - 會員點數紀錄
 */

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet() {
  var ssId = '16d0uBEib8z_oG8YfECC3zWaL6YUtgeyH_bNOwIh5MAo';
  try {
    return SpreadsheetApp.openById(ssId);
  } catch (e) {
    throw new Error('連不到試算表！請檢查權限或 ID。錯誤內容: ' + e.message);
  }
}

function getSheetSafe(name) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    var allNames = ss.getSheets().map(function (s) { return "'" + s.getName() + "'"; }).join(', ');
    throw new Error("找不到分頁 '" + name + "'。目前有的分頁為: " + allNames);
  }
  return sheet;
}

function doGet(e) {
  try {
    var action = e.parameter.action;
    var callback = e.parameter.callback;
    if (action === 'getShifts') {
      var payload = buildShiftsPayload();
      if (callback) {
        return ContentService.createTextOutput(callback + '(' + JSON.stringify(payload) + ')')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return createJsonResponse(payload);
    }
    if (action === 'lookupMember') {
      var lookupResult = lookupMember(e.parameter.server, e.parameter.characterId);
      if (callback) {
        var lookupJson = lookupResult.getContent();
        return ContentService.createTextOutput(callback + '(' + lookupJson + ')')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return lookupResult;
    }
    return createJsonResponse({ success: false, message: '無效的 GET 請求' });
  } catch (err) {
    var errorPayload = { success: false, message: err.message };
    if (e.parameter.callback) {
      return ContentService.createTextOutput(e.parameter.callback + '(' + JSON.stringify(errorPayload) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return createJsonResponse(errorPayload);
  }
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    if (action === 'login') return login(data.username, data.password);
    if (action === 'addShift') return addShift(data);
    if (action === 'makeBooking') return makeBooking(data);
    if (action === 'joinExistingBooking') return joinExistingBooking(data);
    if (action === 'endShift') return endShift(data.shiftId);
    if (action === 'registerMember') return registerMember(data);
    if (action === 'lookupMember') return lookupMember(data.server, data.characterId);
    if (action === 'adminSearchMembers') return adminSearchMembers(data);
    if (action === 'adjustMemberPoints') return adjustMemberPoints(data);
    if (action === 'recordMemberSpending') return recordMemberSpending(data);
    return createJsonResponse({ success: false, message: '無效的 POST 請求' });
  } catch (err) {
    return createJsonResponse({ success: false, message: err.message });
  }
}

function login(u, p) {
  var sheet = getSheetSafe('主持人帳號表');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == u && data[i][1] == p) {
      return createJsonResponse({
        success: true,
        displayName: data[i][2],
        games: data[i][3].toString().split(',')
      });
    }
  }
  return createJsonResponse({ success: false, message: '帳號或密碼錯誤' });
}

function parseMemberLine(line) {
  line = String(line || '').trim();
  if (!line) return null;
  var slash = line.indexOf('/');
  if (slash < 0) return null;
  return {
    server: line.slice(0, slash).trim(),
    characterId: line.slice(slash + 1).trim()
  };
}

function parseBookingMembers(row) {
  var host = {
    server: String(row[6] || '').trim(),
    characterId: String(row[7] || '').trim()
  };
  var joinMembers = [];
  var seen = {};
  if (host.server || host.characterId) {
    seen[host.server + '\t' + host.characterId] = true;
  }

  var memo = String(row[13] || '').trim();
  if (memo) {
    memo.split('\n').forEach(function (line) {
      var member = parseMemberLine(line);
      if (!member || (!member.server && !member.characterId)) return;
      var key = member.server + '\t' + member.characterId;
      if (seen[key]) return;
      seen[key] = true;
      if (member.server === host.server && member.characterId === host.characterId) return;
      joinMembers.push(member);
    });
  }

  if (!host.server && !host.characterId && memo) {
    var first = parseMemberLine(memo.split('\n')[0]);
    if (first) {
      host = first;
      joinMembers = joinMembers.filter(function (m) {
        return !(m.server === host.server && m.characterId === host.characterId);
      });
    }
  }

  return { host: host, joinMembers: joinMembers };
}

function buildShiftsPayload() {
  var ss = getSpreadsheet();
  var shiftSheet = getSheetSafe('預約總表');
  var bookingSheet = getSheetSafe('併桌團員明細');

  var shifts = shiftSheet.getDataRange().getValues();
  var bookings = bookingSheet.getDataRange().getValues();

  var result = [];
  for (var i = 1; i < shifts.length; i++) {
    var shiftId = shifts[i][0];
    var shiftBookings = [];
    for (var j = 1; j < bookings.length; j++) {
      if (bookings[j][1] === shiftId) {
        var members = parseBookingMembers(bookings[j]);
        shiftBookings.push({
          bookingId: bookings[j][0],
          startTime: formatTime(bookings[j][2]),
          endTime: formatTime(bookings[j][3]),
          game: bookings[j][4],
          type: bookings[j][5],
          server: members.host.server,
          characterId: members.host.characterId,
          host: members.host,
          joinMembers: members.joinMembers,
          playerCount: parseInt(bookings[j][10] || 0, 10),
          joinedCount: parseInt(bookings[j][11] || 0, 10)
        });
      }
    }
    result.push({
      shiftId: shiftId,
      date: shifts[i][1] instanceof Date ? Utilities.formatDate(shifts[i][1], 'GMT+8', 'yyyy-MM-dd') : shifts[i][1],
      startTime: formatTime(shifts[i][2]),
      endTime: formatTime(shifts[i][3]),
      host: shifts[i][4],
      gamesOffered: shifts[i][5].toString().split(','),
      status: shifts[i][6],
      bookings: shiftBookings
    });
  }
  return { success: true, data: result };
}

function getShifts() {
  return createJsonResponse(buildShiftsPayload());
}

function formatTime(timeVal) {
  if (timeVal instanceof Date) {
    return Utilities.formatDate(timeVal, 'GMT+8', 'HH:mm');
  }
  if (typeof timeVal === 'number' && !isNaN(timeVal)) {
    var totalMinutes = Math.round(timeVal * 24 * 60) % (24 * 60);
    var hours = Math.floor(totalMinutes / 60);
    var minutes = totalMinutes % 60;
    return padTimePart(hours) + ':' + padTimePart(minutes);
  }
  var s = String(timeVal || '').trim();
  if (!s) return '';
  var hhmm = s.match(/^(\d{1,2}):(\d{2})/);
  if (hhmm) {
    return padTimePart(parseInt(hhmm[1], 10)) + ':' + hhmm[2];
  }
  if (s.indexOf('T') !== -1) return s.split('T')[1].substring(0, 5);
  var pm = s.match(/下午\s*(\d{1,2}):(\d{2})/);
  if (pm) {
    var pmHour = parseInt(pm[1], 10);
    if (pmHour < 12) pmHour += 12;
    return padTimePart(pmHour) + ':' + pm[2];
  }
  var am = s.match(/上午\s*(\d{1,2}):(\d{2})/);
  if (am) {
    var amHour = parseInt(am[1], 10);
    if (amHour === 12) amHour = 0;
    return padTimePart(amHour) + ':' + am[2];
  }
  return s.substring(0, 5);
}

function padTimePart(n) {
  return (n < 10 ? '0' : '') + n;
}

function timeToMinutes(t) {
  var p = t.split(':');
  return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
}

function addShift(d) {
  var sheet = getSheetSafe('預約總表');
  var id = 'S' + new Date().getTime();
  sheet.appendRow([id, d.date, d.startTime, d.endTime, d.host, d.gamesOffered.join(','), '開放中']);
  return createJsonResponse({ success: true });
}

function isSplendorGameName(gameName) {
  var name = String(gameName || '');
  return name.indexOf('璀璨寶石') !== -1 || name.indexOf('水晶商會') !== -1 || /splendor/i.test(name);
}

function getPlayerMaxForGame(gameName) {
  return isSplendorGameName(gameName) ? 4 : 10;
}

function makeBooking(d) {
  var bookingSheet = getSheetSafe('併桌團員明細');
  var playerMax = getPlayerMaxForGame(d.game);
  var playerCount = parseInt(d.playerCount, 10) || 0;
  if (playerCount < 1 || playerCount > playerMax) {
    return createJsonResponse({
      success: false,
      message: playerMax === 4 ? '【璀璨寶石】人數最多 4 人。' : '人數須為 1–10 人。'
    });
  }

  var bookings = bookingSheet.getDataRange().getValues();
  var newStart = timeToMinutes(d.bookingStartTime);
  var newEnd = timeToMinutes(d.bookingEndTime);
  var buffer = 30;

  for (var i = 1; i < bookings.length; i++) {
    if (bookings[i][1] === d.shiftId) {
      var existStart = timeToMinutes(formatTime(bookings[i][2]));
      var existEnd = timeToMinutes(formatTime(bookings[i][3]));
      if (!(newEnd <= (existStart - buffer) || newStart >= (existEnd + buffer))) {
        if (d.type === '併桌' && bookings[i][5] === '併桌' && d.game === bookings[i][4] && formatTime(bookings[i][2]) === d.bookingStartTime) {
          continue;
        }
        return createJsonResponse({ success: false, message: '此時段已有預約（需留 30 分鐘間隔）。' });
      }
    }
  }

  var memberInfo = d.members.map(function (m) { return m.server + '/' + m.characterId; }).join('\n');
  bookingSheet.appendRow([
    'B' + new Date().getTime(), d.shiftId, d.bookingStartTime, d.bookingEndTime,
    d.game, d.type, d.members[0].server, d.members[0].characterId,
    d.useGem ? '使用寶石兌換' : '一般付費', new Date(), d.playerCount, 0, d.rounds, memberInfo
  ]);
  return createJsonResponse({ success: true, message: '預約成功' });
}

function joinExistingBooking(d) {
  var sheet = getSheetSafe('併桌團員明細');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === d.bookingId) {
      if (String(data[i][5] || '') !== '併桌') {
        return createJsonResponse({ success: false, message: '此預約為包場，無法加入併桌。' });
      }

      var initialCount = parseInt(data[i][10] || 0, 10);
      var currentJoined = parseInt(data[i][11] || 0, 10);
      var addCount = parseInt(d.addCount, 10) || 1;
      if (addCount < 1) addCount = 1;

      var playerMax = getPlayerMaxForGame(data[i][4]);
      var currentTotal = initialCount + currentJoined;
      if (currentTotal >= playerMax) {
        return createJsonResponse({
          success: false,
          message: playerMax === 4 ? '此桌已滿（【璀璨寶石】上限 4 人）。' : '此桌已滿（上限 10 人）。'
        });
      }
      if (currentTotal + addCount > playerMax) {
        return createJsonResponse({
          success: false,
          message: '僅剩 ' + (playerMax - currentTotal) + ' 個名額。'
        });
      }

      sheet.getRange(i + 1, 12).setValue(currentJoined + addCount);
      var newMemberInfo = d.members.map(function (m) { return m.server + '/' + m.characterId; }).join('\n');
      var memo = data[i][13] || '';
      memo += (memo ? '\n' : '') + newMemberInfo;
      sheet.getRange(i + 1, 14).setValue(memo);
      return createJsonResponse({ success: true, message: '成功加入併桌！' });
    }
  }
  return createJsonResponse({ success: false, message: '找不到該預約團。' });
}

function endShift(id) {
  var sheet = getSheetSafe('預約總表');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, 7).setValue('已結束');
      return createJsonResponse({ success: true });
    }
  }
  return createJsonResponse({ success: false });
}

/* ── 會員點數 ── */

function memberToObject(row) {
  var totalSpent = parseInt(row[7], 10) || 0;
  var points = parseInt(row[3], 10) || 0;
  return {
    memberId: row[0],
    server: String(row[1] || '').trim(),
    characterId: String(row[2] || '').trim(),
    points: points,
    totalSpent: totalSpent,
    spendToNextPoint: 350000 - (totalSpent % 350000),
    registeredAt: row[4] instanceof Date
      ? Utilities.formatDate(row[4], 'GMT+8', 'yyyy-MM-dd HH:mm')
      : String(row[4] || ''),
    note: String(row[5] || ''),
    lastUpdated: row[6] instanceof Date
      ? Utilities.formatDate(row[6], 'GMT+8', 'yyyy-MM-dd HH:mm')
      : String(row[6] || '')
  };
}

function findMemberRow(sheet, server, characterId) {
  var data = sheet.getDataRange().getValues();
  var targetServer = String(server || '').trim();
  var targetChar = String(characterId || '').trim();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1] || '').trim() === targetServer &&
        String(data[i][2] || '').trim() === targetChar) {
      return { rowIndex: i + 1, row: data[i] };
    }
  }
  return null;
}

function findMemberRowById(sheet, memberId) {
  var data = sheet.getDataRange().getValues();
  var targetId = String(memberId || '').trim();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === targetId) {
      return { rowIndex: i + 1, row: data[i] };
    }
  }
  return null;
}

function verifyHostCredentials(username, password) {
  var sheet = getSheetSafe('主持人帳號表');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == username && data[i][1] == password) {
      return { displayName: data[i][2] };
    }
  }
  return null;
}

function appendPointsLog(memberRow, change, balanceAfter, reason, operator) {
  try {
    var logSheet = getSheetSafe('會員點數紀錄');
    logSheet.appendRow([
      'L' + new Date().getTime(),
      memberRow[0],
      memberRow[1],
      memberRow[2],
      change,
      balanceAfter,
      reason || '',
      operator || '',
      new Date()
    ]);
  } catch (e) {
    // 紀錄分頁不存在時仍允許調整點數
  }
}

function registerMember(d) {
  var host = verifyHostCredentials(d.username, d.password);
  if (!host) {
    return createJsonResponse({ success: false, message: '主持人驗證失敗。' });
  }

  var server = String(d.server || '').trim();
  var characterId = String(d.characterId || '').trim();
  if (!server || !characterId) {
    return createJsonResponse({ success: false, message: '請填寫世界與角色名。' });
  }

  var sheet = getSheetSafe('會員名冊');
  if (findMemberRow(sheet, server, characterId)) {
    return createJsonResponse({ success: false, message: '此角色已登記為會員。' });
  }

  var id = 'M' + new Date().getTime();
  var now = new Date();
  sheet.appendRow([id, server, characterId, 0, now, '', now, 0]);
  return createJsonResponse({
    success: true,
    message: '會員登記成功！',
    data: { memberId: id, server: server, characterId: characterId, points: 0 }
  });
}

function lookupMember(server, characterId) {
  var sheet = getSheetSafe('會員名冊');
  var found = findMemberRow(sheet, server, characterId);
  if (!found) {
    return createJsonResponse({ success: false, message: '找不到此會員，請向店長登記。' });
  }
  return createJsonResponse({ success: true, data: memberToObject(found.row) });
}

function adminSearchMembers(d) {
  var host = verifyHostCredentials(d.username, d.password);
  if (!host) {
    return createJsonResponse({ success: false, message: '主持人驗證失敗。' });
  }

  var query = String(d.query || '').trim().toLowerCase();
  var serverFilter = String(d.server || '').trim();
  var sheet = getSheetSafe('會員名冊');
  var data = sheet.getDataRange().getValues();
  var results = [];

  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    var member = memberToObject(data[i]);
    if (serverFilter && member.server !== serverFilter) continue;
    if (query) {
      var haystack = (member.characterId + ' ' + member.server + ' ' + member.memberId).toLowerCase();
      if (haystack.indexOf(query) === -1) continue;
    }
    results.push(member);
  }

  results.sort(function (a, b) {
    if (b.points !== a.points) return b.points - a.points;
    return a.characterId.localeCompare(b.characterId, 'zh-Hant');
  });

  return createJsonResponse({ success: true, data: results });
}

function adjustMemberPoints(d) {
  var host = verifyHostCredentials(d.username, d.password);
  if (!host) {
    return createJsonResponse({ success: false, message: '主持人驗證失敗。' });
  }

  var sheet = getSheetSafe('會員名冊');
  var found = null;
  if (d.memberId) {
    found = findMemberRowById(sheet, d.memberId);
  } else {
    found = findMemberRow(sheet, d.server, d.characterId);
  }
  if (!found) {
    return createJsonResponse({ success: false, message: '找不到會員。' });
  }

  var delta = parseInt(d.pointsDelta, 10);
  if (isNaN(delta) || delta === 0) {
    return createJsonResponse({ success: false, message: '請輸入有效的點數增減（不可為 0）。' });
  }

  var currentPoints = parseInt(found.row[3], 10) || 0;
  var newPoints = currentPoints + delta;
  if (newPoints < 0) {
    return createJsonResponse({ success: false, message: '點數不足，無法扣減至負數。' });
  }

  var now = new Date();
  sheet.getRange(found.rowIndex, 4).setValue(newPoints);
  sheet.getRange(found.rowIndex, 7).setValue(now);

  appendPointsLog(
    found.row,
    delta,
    newPoints,
    String(d.reason || '').trim(),
    host.displayName || d.username
  );

  found.row[3] = newPoints;
  found.row[6] = now;
  return createJsonResponse({
    success: true,
    message: '點數已更新（' + (delta > 0 ? '+' : '') + delta + '）',
    data: memberToObject(found.row)
  });
}

var SPEND_PER_POINT = 350000;

function recordMemberSpending(d) {
  var host = verifyHostCredentials(d.username, d.password);
  if (!host) {
    return createJsonResponse({ success: false, message: '主持人驗證失敗。' });
  }

  var sheet = getSheetSafe('會員名冊');
  var found = null;
  if (d.memberId) {
    found = findMemberRowById(sheet, d.memberId);
  } else {
    found = findMemberRow(sheet, d.server, d.characterId);
  }
  if (!found) {
    return createJsonResponse({ success: false, message: '找不到會員。' });
  }

  var amount = parseInt(d.amount, 10);
  if (isNaN(amount) || amount <= 0) {
    return createJsonResponse({ success: false, message: '請輸入有效的消費金額（gil）。' });
  }

  var oldSpent = parseInt(found.row[7], 10) || 0;
  var newSpent = oldSpent + amount;
  var pointsToAdd = Math.floor(newSpent / SPEND_PER_POINT) - Math.floor(oldSpent / SPEND_PER_POINT);
  var now = new Date();

  sheet.getRange(found.rowIndex, 8).setValue(newSpent);
  found.row[7] = newSpent;

  var currentPoints = parseInt(found.row[3], 10) || 0;
  var newPoints = currentPoints;
  if (pointsToAdd > 0) {
    newPoints = currentPoints + pointsToAdd;
    sheet.getRange(found.rowIndex, 4).setValue(newPoints);
    found.row[3] = newPoints;
    appendPointsLog(
      found.row,
      pointsToAdd,
      newPoints,
      '消費 ' + amount + ' gil（累積達標自動加點）',
      host.displayName || d.username
    );
  }

  sheet.getRange(found.rowIndex, 7).setValue(now);
  found.row[6] = now;

  var msg = '已登記消費 ' + amount + ' gil';
  if (pointsToAdd > 0) {
    msg += '，自動獲得 ' + pointsToAdd + ' 點';
  } else {
    var need = SPEND_PER_POINT - (newSpent % SPEND_PER_POINT);
    msg += '。距離下一點尚差 ' + need + ' gil';
  }

  return createJsonResponse({
    success: true,
    message: msg,
    data: memberToObject(found.row)
  });
}
