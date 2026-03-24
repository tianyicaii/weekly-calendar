/**
 * Weekly Calendar Application
 * Pure HTML + CSS + JS, no framework dependencies.
 */

'use strict';

// ============================================================
// Global State
// ============================================================

/** @type {Date} Monday of the currently displayed week */
let currentWeekStart = null;

/** @type {Array<Object>} In-memory event store */
let events = [];

/** localStorage key for persisting events */
let STORAGE_KEY = 'weekly-calendar-events';

/** @type {string|null} ID of the event currently being edited, null for create mode */
let currentEditingEventId = null;


/** Default color for new events */
const DEFAULT_EVENT_COLOR = '#4285f4';

// ============================================================
// DOM References
// ============================================================

const DOM = {};

function cacheDOMReferences() {
  DOM.weekTitle        = document.getElementById('week-title');
  DOM.btnPrevWeek      = document.getElementById('btn-prev-week');
  DOM.btnToday         = document.getElementById('btn-today');
  DOM.btnNextWeek      = document.getElementById('btn-next-week');
  // Data persistence buttons
  DOM.btnImport        = document.getElementById('btn-import');
  DOM.btnDownload      = document.getElementById('btn-download');
  DOM.btnExportTXT     = document.getElementById('btn-export-txt');
  DOM.toast            = document.getElementById('toast');
  DOM.calendarScroll   = document.getElementById('calendar-scroll');
  DOM.timeColumn       = document.getElementById('time-column');
  DOM.daysGrid         = document.getElementById('days-grid');
  DOM.currentTimeLine  = document.getElementById('current-time-line');
  DOM.headerDays       = document.querySelectorAll('.header-day[data-day-index]');
  DOM.dayColumns       = document.querySelectorAll('.day-column[data-day-index]');

  // Event Modal
  DOM.eventModalOverlay = document.getElementById('event-modal-overlay');
  DOM.eventModal        = document.getElementById('event-modal');
  DOM.modalTitle        = document.getElementById('modal-title');
  DOM.modalCloseBtn     = document.getElementById('modal-close-btn');
  DOM.eventForm         = document.getElementById('event-form');
  DOM.eventTitleInput   = document.getElementById('event-title-input');
  DOM.eventDescInput    = document.getElementById('event-description-input');
  DOM.eventDateInput    = document.getElementById('event-date-input');
  DOM.eventStartInput   = document.getElementById('event-start-input');
  DOM.eventEndInput     = document.getElementById('event-end-input');
  DOM.eventColorInput   = document.getElementById('event-color-input');
  DOM.eventColorPicker  = document.getElementById('event-color-picker');
  DOM.btnDeleteEvent    = document.getElementById('btn-delete-event');
  DOM.btnCancelEvent    = document.getElementById('btn-cancel-event');
  DOM.btnSaveEvent      = document.getElementById('btn-save-event');

  // Export Modal
  DOM.exportModalOverlay = document.getElementById('export-modal-overlay');
  DOM.exportModalCloseBtn = document.getElementById('export-modal-close-btn');
  DOM.exportForm         = document.getElementById('export-form');
  DOM.exportStartDate    = document.getElementById('export-start-date');
  DOM.exportEndDate      = document.getElementById('export-end-date');
  DOM.btnCancelExport    = document.getElementById('btn-cancel-export');

  // Hidden file input
  DOM.fileImportInput = document.getElementById('file-import-input');

}

// ============================================================
// Date Utility Functions
// ============================================================

/**
 * Get the Monday of the week containing the given date.
 * @param {Date} date
 * @returns {Date}
 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust to Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Format a date for the column header, e.g. "Mon 3/24".
 * @param {Date} date
 * @returns {{dayName: string, dayDate: string}}
 */
function formatHeaderDate(date) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    dayName: dayNames[date.getDay()],
    dayDate: (date.getMonth() + 1) + '/' + date.getDate()
  };
}

/**
 * Add (or subtract) days from a date.
 * @param {Date} date
 * @param {number} n
 * @returns {Date}
 */
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/**
 * Generate a simple unique ID.
 * @returns {string}
 */
function generateId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

// ============================================================
// Initialization
// ============================================================

function init() {
  cacheDOMReferences();
  currentWeekStart = getWeekStart(new Date());
  loadFromLocalStorage();
  renderTimeColumn();
  renderGridLines();
  renderWeek();
  bindToolbarEvents();
  bindModalEvents();
  bindDragToCreate();
  bindKeyboardShortcuts();
  bindDoubleClickCreate();
  bindResizeHandler();
  updateCurrentTimeLine();
  // Update time line every minute
  setInterval(updateCurrentTimeLine, 60000);
  // At midnight, refresh the week view so today-highlight and time line stay correct
  scheduleMidnightRefresh();
  // Scroll so that 7:00 AM is at the top of the visible area
  DOM.calendarScroll.scrollTop = 7 * 60; // 7h * 60px/h = 420px
}

// ============================================================
// Rendering
// ============================================================

/** Render the time labels in the time column (00:00 – 23:00). */
function renderTimeColumn() {
  DOM.timeColumn.innerHTML = '';
  for (let h = 0; h < 24; h++) {
    const label = document.createElement('div');
    label.className = 'time-label';
    label.style.top = (h * 2 * 30) + 'px'; // slotHeight=30, 2 slots/hour
    label.textContent = String(h).padStart(2, '0') + ':00';
    DOM.timeColumn.appendChild(label);
  }
}

/**
 * Render horizontal grid lines (hour = solid, half-hour = dashed)
 * inside each day-column. Also adds matching lines in the time column.
 * Called once on init; lines are static and do not change.
 */
function renderGridLines() {
  const slotHeight = 30; // px per 30-min slot
  const totalSlots = 48; // 24h * 2

  // Render grid lines in each day column
  DOM.dayColumns.forEach(function (col) {
    for (let slot = 1; slot < totalSlots; slot++) {
      const line = document.createElement('div');
      line.className = 'grid-line';
      if (slot % 2 !== 0) {
        // Odd slots = half-hour marks (0:30, 1:30, ...)
        line.classList.add('half-hour');
      }
      line.style.top = (slot * slotHeight) + 'px';
      col.appendChild(line);
    }
  });

  // Render matching lines in the time column for visual alignment
  for (let slot = 1; slot < totalSlots; slot++) {
    const line = document.createElement('div');
    line.className = 'time-grid-line';
    if (slot % 2 !== 0) {
      line.classList.add('half-hour');
    }
    line.style.top = (slot * slotHeight) + 'px';
    DOM.timeColumn.appendChild(line);
  }
}

/** Render / refresh the week view (header + grid). */
function renderWeek() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Update header day labels
  for (let i = 0; i < 7; i++) {
    const date = addDays(currentWeekStart, i);
    const { dayName, dayDate } = formatHeaderDate(date);
    const headerEl = DOM.headerDays[i];
    headerEl.querySelector('.header-day-name').textContent = dayName;
    headerEl.querySelector('.header-day-date').textContent = dayDate;

    // Today highlight
    const isToday = date.getTime() === today.getTime();
    headerEl.classList.toggle('today', isToday);
    DOM.dayColumns[i].classList.toggle('today', isToday);
  }

  // Update toolbar title (e.g. "Mar 23 – Mar 29, 2026")
  const weekEnd = addDays(currentWeekStart, 6);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const startStr = months[currentWeekStart.getMonth()] + ' ' + currentWeekStart.getDate();
  const endStr = months[weekEnd.getMonth()] + ' ' + weekEnd.getDate() + ', ' + weekEnd.getFullYear();
  DOM.weekTitle.textContent = startStr + ' – ' + endStr;

  // Re-render events (placeholder for future substep)
  renderEvents();

  // Update current time line position
  updateCurrentTimeLine();
}

/**
 * Assign columns to overlapping events using a greedy algorithm.
 * Events must already be sorted by start time.
 * Returns array of objects: { event, colIndex, totalCols }
 * @param {Array<Object>} dayEvents – events for a single day, sorted by startTime
 * @returns {Array<{event: Object, startSlot: number, endSlot: number, colIndex: number, totalCols: number}>}
 */
function assignOverlapColumns(dayEvents) {
  if (dayEvents.length === 0) return [];

  // Compute slot ranges and sort by start
  var items = dayEvents.map(function (evt) {
    var startSlot = timeStringToSlot(evt.startTime);
    var endSlot = timeStringToSlot(evt.endTime);
    if (endSlot <= startSlot) endSlot = startSlot + 1;
    return { event: evt, startSlot: startSlot, endSlot: endSlot, colIndex: -1, totalCols: 1 };
  });
  items.sort(function (a, b) { return a.startSlot - b.startSlot || a.endSlot - b.endSlot; });

  // Greedy column assignment: for each event, find the leftmost column
  // where no previously-assigned event overlaps.
  // columns[c] = endSlot of the latest event placed in column c
  var columns = [];

  items.forEach(function (item) {
    var placed = false;
    for (var c = 0; c < columns.length; c++) {
      if (columns[c] <= item.startSlot) {
        // No overlap – place here
        item.colIndex = c;
        columns[c] = item.endSlot;
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Need a new column
      item.colIndex = columns.length;
      columns.push(item.endSlot);
    }
  });

  // Now determine connected overlap groups so that events sharing
  // the same visual cluster get the same totalCols value.
  // Two events are in the same group if they overlap (directly or transitively).
  // Build groups of events that are all connected via overlap chains.
  // Within each group, the group's totalCols = max colIndex + 1 for that group.
  // We use a simple sweep: maintain a running "groupEnd" – the furthest endSlot
  // seen so far. When a new event starts after groupEnd, a new group begins.
  var groups = []; // each group: { startIdx, endIdx, maxCol }
  var groupStart = 0;
  var groupEnd = items[0].endSlot;
  var groupMaxCol = items[0].colIndex;

  for (var i = 1; i < items.length; i++) {
    if (items[i].startSlot < groupEnd) {
      // Overlaps with current group
      groupEnd = Math.max(groupEnd, items[i].endSlot);
      groupMaxCol = Math.max(groupMaxCol, items[i].colIndex);
    } else {
      // New group – finalize previous
      groups.push({ startIdx: groupStart, endIdx: i - 1, maxCol: groupMaxCol });
      groupStart = i;
      groupEnd = items[i].endSlot;
      groupMaxCol = items[i].colIndex;
    }
  }
  groups.push({ startIdx: groupStart, endIdx: items.length - 1, maxCol: groupMaxCol });

  // Assign totalCols per group
  groups.forEach(function (g) {
    var cols = g.maxCol + 1;
    for (var j = g.startIdx; j <= g.endIdx; j++) {
      items[j].totalCols = cols;
    }
  });

  return items;
}

/**
 * Render all events on the grid for the currently displayed week.
 * Clears existing event blocks first, then creates new ones.
 * Handles overlapping events by placing them side-by-side using
 * a greedy column-assignment algorithm.
 */
function renderEvents() {
  // Remove all existing event blocks
  var existingBlocks = document.querySelectorAll('.event-block');
  existingBlocks.forEach(function (block) {
    block.parentNode.removeChild(block);
  });

  // Remove any lingering tooltips
  var existingTooltips = document.querySelectorAll('.event-tooltip');
  existingTooltips.forEach(function (tip) {
    tip.parentNode.removeChild(tip);
  });

  // Determine the date range of the current week (Mon-Sun)
  var weekDates = [];
  for (var i = 0; i < 7; i++) {
    var d = addDays(currentWeekStart, i);
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    weekDates.push(yyyy + '-' + mm + '-' + dd);
  }

  // Group events by day index
  var eventsByDay = {};
  events.forEach(function (evt) {
    var dayIndex = weekDates.indexOf(evt.date);
    if (dayIndex === -1) return;
    if (!eventsByDay[dayIndex]) eventsByDay[dayIndex] = [];
    eventsByDay[dayIndex].push(evt);
  });

  // For each day, assign overlap columns and render
  Object.keys(eventsByDay).forEach(function (dayIndexStr) {
    var dayIndex = parseInt(dayIndexStr, 10);
    var dayEvents = eventsByDay[dayIndex];

    // Sort by start time
    dayEvents.sort(function (a, b) {
      return a.startTime.localeCompare(b.startTime);
    });

    var layoutItems = assignOverlapColumns(dayEvents);
    var column = DOM.dayColumns[dayIndex];

    layoutItems.forEach(function (item) {
      var evt = item.event;
      var top = item.startSlot * SLOT_HEIGHT;
      var height = (item.endSlot - item.startSlot) * SLOT_HEIGHT;

      // Calculate horizontal position based on overlap columns
      // Use percentage-based widths relative to the day column
      var widthPercent = 100 / item.totalCols;
      var leftPercent = item.colIndex * widthPercent;

      var block = document.createElement('div');
      block.className = 'event-block';
      block.setAttribute('data-event-id', evt.id);
      block.style.top = top + 'px';
      block.style.height = height + 'px';
      block.style.background = evt.color || DEFAULT_EVENT_COLOR;
      block.style.left = leftPercent + '%';
      block.style.width = 'calc(' + widthPercent + '% - 4px)';

      var titleEl = document.createElement('div');
      titleEl.className = 'event-title';
      titleEl.textContent = evt.title;

      var timeEl = document.createElement('div');
      timeEl.className = 'event-time';
      timeEl.textContent = evt.startTime + ' – ' + evt.endTime;

      block.appendChild(titleEl);
      block.appendChild(timeEl);

      // Click to edit (stop propagation to prevent triggering grid drag)
      block.addEventListener('click', function (e) {
        e.stopPropagation();
        openEditModal(evt.id);
      });

      // Hover tooltip with brief info
      block.addEventListener('mouseenter', function (e) {
        showEventTooltip(e, evt);
      });
      block.addEventListener('mouseleave', function () {
        hideEventTooltip();
      });

      column.appendChild(block);
    });
  });
}

/** @type {HTMLElement|null} Active tooltip element */
var activeTooltip = null;

/**
 * Show a tooltip near the hovered event block with brief event info.
 * @param {MouseEvent} e
 * @param {Object} evt – the event data object
 */
function showEventTooltip(e, evt) {
  hideEventTooltip();

  var tip = document.createElement('div');
  tip.className = 'event-tooltip';

  var titleLine = document.createElement('div');
  titleLine.className = 'event-tooltip-title';
  titleLine.textContent = evt.title;
  tip.appendChild(titleLine);

  var timeLine = document.createElement('div');
  timeLine.className = 'event-tooltip-time';
  timeLine.textContent = evt.startTime + ' – ' + evt.endTime;
  tip.appendChild(timeLine);

  if (evt.description) {
    var descLine = document.createElement('div');
    descLine.className = 'event-tooltip-desc';
    descLine.textContent = evt.description;
    tip.appendChild(descLine);
  }

  document.body.appendChild(tip);
  activeTooltip = tip;

  // Position tooltip near the mouse
  var rect = e.target.closest('.event-block').getBoundingClientRect();
  var tipRect;

  // Initially place off-screen to measure
  tip.style.left = '-9999px';
  tip.style.top = '-9999px';
  tipRect = tip.getBoundingClientRect();

  var left = rect.right + 8;
  var topPos = rect.top;

  // If tooltip would overflow right edge, place to the left
  if (left + tipRect.width > window.innerWidth - 10) {
    left = rect.left - tipRect.width - 8;
  }
  // If tooltip would overflow bottom, adjust up
  if (topPos + tipRect.height > window.innerHeight - 10) {
    topPos = window.innerHeight - tipRect.height - 10;
  }

  tip.style.left = left + 'px';
  tip.style.top = topPos + 'px';
}

/**
 * Remove the active tooltip from the DOM.
 */
function hideEventTooltip() {
  if (activeTooltip && activeTooltip.parentNode) {
    activeTooltip.parentNode.removeChild(activeTooltip);
  }
  activeTooltip = null;
}

/**
 * Convert a time string "HH:MM" to a slot index (0-48).
 * @param {string} timeStr – e.g. "09:30"
 * @returns {number}
 */
function timeStringToSlot(timeStr) {
  var parts = timeStr.split(':');
  var h = parseInt(parts[0], 10) || 0;
  var m = parseInt(parts[1], 10) || 0;
  var totalMinutes = h * 60 + m;
  return Math.round(totalMinutes / 30);
}

/**
 * Snap a time string "HH:MM" to the nearest 30-minute grid boundary.
 * E.g. "09:17" → "09:30", "09:14" → "09:00", "23:50" → "24:00".
 * For start times, use isEndTime=false (clamps to 00:00–23:30).
 * For end times, use isEndTime=true (clamps to 00:00–24:00).
 * @param {string} timeStr – e.g. "09:17"
 * @param {boolean} [isEndTime=false] – if true, allows slot 48 (24:00)
 * @returns {string} – snapped time string, e.g. "09:30"
 */
function snapTimeTo30Min(timeStr, isEndTime) {
  var slot = timeStringToSlot(timeStr);
  var maxSlot = isEndTime ? TOTAL_SLOTS : TOTAL_SLOTS - 1;
  slot = Math.max(0, Math.min(maxSlot, slot));
  return slotToTimeString(slot);
}

/** Update the current time indicator line position. */
function updateCurrentTimeLine() {
  const now = new Date();
  const dayIndex = getDayIndexInCurrentWeek(now);
  if (dayIndex < 0 || dayIndex > 6) {
    DOM.currentTimeLine.style.display = 'none';
    return;
  }
  const minutes = now.getHours() * 60 + now.getMinutes();
  const top = (minutes / 30) * 30; // slotHeight = 30px per 30 min
  DOM.currentTimeLine.style.display = 'block';
  DOM.currentTimeLine.style.top = top + 'px';
}

/**
 * Returns the 0-based day index (Mon=0 .. Sun=6) if the date is in the
 * currently displayed week, or -1 otherwise.
 */
function getDayIndexInCurrentWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const weekStart = new Date(currentWeekStart);
  const diff = (d - weekStart) / (1000 * 60 * 60 * 24);
  if (diff >= 0 && diff < 7) {
    return Math.floor(diff);
  }
  return -1;
}

/** Scroll the calendar to a given hour/minute position. */
function scrollToTime(hours, minutes) {
  const top = ((hours * 60 + minutes) / 30) * 30;
  DOM.calendarScroll.scrollTop = Math.max(0, top - 60); // offset a bit above
}

/**
 * Schedule a renderWeek() call at the next midnight so the today-highlight
 * and current-time-line stay correct across day boundaries.
 * Re-schedules itself each night.
 */
function scheduleMidnightRefresh() {
  var now = new Date();
  var midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  var ms = midnight - now;
  setTimeout(function () {
    renderWeek();
    scheduleMidnightRefresh();
  }, ms);
}

// ============================================================
// localStorage Persistence
// ============================================================

/**
 * Save the current events array to localStorage.
 * Called automatically after every CRUD operation.
 */
function saveToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch (e) {
    showToast('Failed to save: ' + e.message, 'error');
  }
}

/**
 * Load events from localStorage on startup.
 */
function loadFromLocalStorage() {
  try {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      var parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        events = parsed;
      }
    }
  } catch (e) {
    // Corrupted data — start fresh but don't lose other data
    console.warn('Failed to load from localStorage:', e);
  }
}

// ============================================================
// Toast Notifications
// ============================================================

/** @type {number|null} Active toast timeout id */
let toastTimeoutId = null;

/**
 * Show a brief toast notification.
 * @param {string} message
 * @param {'info'|'error'|'success'} [type='info']
 * @param {number} [duration=3000] – milliseconds before auto-dismiss
 */
function showToast(message, type, duration) {
  type = type || 'info';
  duration = duration || 3000;

  var toast = DOM.toast;
  toast.textContent = message;
  toast.className = 'toast';

  if (type === 'error') {
    toast.classList.add('toast-error');
  } else if (type === 'success') {
    toast.classList.add('toast-success');
  }

  // Force reflow to restart animation if a toast is already visible
  void toast.offsetWidth;
  toast.classList.add('toast-visible');

  if (toastTimeoutId) clearTimeout(toastTimeoutId);
  toastTimeoutId = setTimeout(function () {
    toast.classList.remove('toast-visible');
    toastTimeoutId = null;
  }, duration);
}

// ============================================================
// Data Persistence – Core Functions
// ============================================================

/**
 * Serialize the current events array into a JSON string.
 * @returns {string}
 */
function serializeData() {
  return JSON.stringify({ events: events }, null, 2);
}

/**
 * Validate and parse imported JSON data.
 * Returns the parsed events array on success, or null on failure (with toast).
 * @param {string} jsonString
 * @returns {Array<Object>|null}
 */
function parseAndValidateJSON(jsonString) {
  var parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    showToast('Invalid JSON: ' + e.message, 'error');
    return null;
  }

  // Validate top-level structure
  if (!parsed || typeof parsed !== 'object') {
    showToast('Invalid data format: expected a JSON object with an "events" array.', 'error');
    return null;
  }

  if (!Array.isArray(parsed.events)) {
    showToast('Invalid data format: missing or invalid "events" array.', 'error');
    return null;
  }

  // Validate each event entry
  var validEvents = [];
  for (var i = 0; i < parsed.events.length; i++) {
    var evt = parsed.events[i];
    if (!evt || typeof evt !== 'object') {
      showToast('Invalid event at index ' + i + ': expected an object.', 'error');
      return null;
    }
    if (typeof evt.title !== 'string' || !evt.title.trim()) {
      showToast('Invalid event at index ' + i + ': missing or empty "title".', 'error');
      return null;
    }
    if (typeof evt.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(evt.date)) {
      showToast('Invalid event at index ' + i + ': "date" must be YYYY-MM-DD format.', 'error');
      return null;
    }
    if (typeof evt.startTime !== 'string' || !/^\d{2}:\d{2}$/.test(evt.startTime)) {
      showToast('Invalid event at index ' + i + ': "startTime" must be HH:MM format.', 'error');
      return null;
    }
    if (typeof evt.endTime !== 'string' || !/^\d{2}:\d{2}$/.test(evt.endTime)) {
      showToast('Invalid event at index ' + i + ': "endTime" must be HH:MM format.', 'error');
      return null;
    }

    // Normalize: ensure id exists
    validEvents.push({
      id: evt.id || generateId(),
      title: evt.title.trim(),
      description: (evt.description || '').trim(),
      date: evt.date,
      startTime: evt.startTime,
      endTime: evt.endTime,
      color: evt.color || DEFAULT_EVENT_COLOR
    });
  }

  return validEvents;
}

/**
 * Load events from parsed data, replacing the current in-memory store.
 * Re-renders the calendar.
 * @param {Array<Object>} newEvents
 */
function loadEvents(newEvents) {
  events = newEvents;
  renderEvents();
}


// ============================================================
// Data Persistence – Download / Upload Fallback Mode
// ============================================================

/**
 * Import data from a local JSON file via hidden <input type="file">.
 */
function handleImport() {
  DOM.fileImportInput.value = ''; // reset so the same file can be re-selected
  DOM.fileImportInput.click();
}

/**
 * Process the file selected by the hidden file input.
 * @param {Event} e – change event from the file input
 */
function handleFileInputChange(e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function (loadEvent) {
    var text = loadEvent.target.result;
    var parsed = parseAndValidateJSON(text);
    if (parsed === null) return;

    // If there are existing events, ask for confirmation
    if (events.length > 0) {
      var confirmed = confirm(
        'You have ' + events.length + ' existing event(s). Importing will replace them with ' +
        parsed.length + ' event(s) from the file.\n\nTip: Download your current data first as a backup.\n\nContinue?'
      );
      if (!confirmed) return;
    }

    loadEvents(parsed);
    saveToLocalStorage();
    showToast('Imported: ' + file.name + ' (' + parsed.length + ' events)', 'success');
  };
  reader.onerror = function () {
    showToast('Error reading file.', 'error');
  };
  reader.readAsText(file);
}

/**
 * Download the current events as a JSON file using Blob + Object URL.
 */
function handleDownload() {
  var json = serializeData();
  var blob = new Blob([json], { type: 'application/json' });
  var url = URL.createObjectURL(blob);

  var a = document.createElement('a');
  a.href = url;
  a.download = 'calendar-data.json';
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(function () {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);

  showToast('Downloaded calendar-data.json', 'success');
}

// ============================================================
// Toolbar Event Bindings
// ============================================================

function bindToolbarEvents() {
  DOM.btnPrevWeek.addEventListener('click', function () {
    currentWeekStart = addDays(currentWeekStart, -7);
    renderWeek();
  });

  DOM.btnNextWeek.addEventListener('click', function () {
    currentWeekStart = addDays(currentWeekStart, 7);
    renderWeek();
  });

  DOM.btnToday.addEventListener('click', function () {
    var now = new Date();
    currentWeekStart = getWeekStart(now);
    renderWeek();
    scrollToTime(now.getHours(), now.getMinutes());
  });

  // Import / Download buttons
  DOM.btnImport.addEventListener('click', function () {
    handleImport();
  });
  DOM.btnDownload.addEventListener('click', function () {
    handleDownload();
  });

  // Hidden file input change handler (for import)
  DOM.fileImportInput.addEventListener('change', handleFileInputChange);

  // Export TXT – open export modal with default date range
  DOM.btnExportTXT.addEventListener('click', function () {
    openExportModalWithDefaults();
  });
}

// ============================================================
// Modal Event Bindings
// ============================================================

function bindModalEvents() {
  // Event modal close
  DOM.modalCloseBtn.addEventListener('click', closeEventModal);
  DOM.btnCancelEvent.addEventListener('click', closeEventModal);
  DOM.eventModalOverlay.addEventListener('click', function (e) {
    if (e.target === DOM.eventModalOverlay) closeEventModal();
  });

  // ESC key closes any open modal
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (DOM.eventModalOverlay.classList.contains('active')) {
        closeEventModal();
      }
      if (DOM.exportModalOverlay.classList.contains('active')) {
        closeExportModal();
      }
    }
  });

  // Event form submit – create or update
  DOM.eventForm.addEventListener('submit', function (e) {
    e.preventDefault();
    handleEventSave();
  });

  // Delete button
  DOM.btnDeleteEvent.addEventListener('click', function () {
    if (currentEditingEventId) {
      handleEventDelete(currentEditingEventId);
    }
  });

  // Color picker interaction
  DOM.eventColorPicker.addEventListener('click', function (e) {
    var swatch = e.target.closest('.color-swatch');
    if (!swatch) return;
    // Remove selected from all swatches
    var swatches = DOM.eventColorPicker.querySelectorAll('.color-swatch');
    swatches.forEach(function (s) { s.classList.remove('selected'); });
    swatch.classList.add('selected');
    DOM.eventColorInput.value = swatch.getAttribute('data-color');
  });

  // Title validation: disable save button when title is empty
  DOM.eventTitleInput.addEventListener('input', function () {
    updateSaveButtonState();
  });

  // Export modal close
  DOM.exportModalCloseBtn.addEventListener('click', closeExportModal);
  DOM.btnCancelExport.addEventListener('click', closeExportModal);
  DOM.exportModalOverlay.addEventListener('click', function (e) {
    if (e.target === DOM.exportModalOverlay) closeExportModal();
  });

  // Export form submit – handle TXT export
  DOM.exportForm.addEventListener('submit', function (e) {
    e.preventDefault();
    handleExportTxt();
  });
}

function openEventModal() {
  DOM.eventModalOverlay.classList.add('active');
  updateSaveButtonState();
}

function closeEventModal() {
  DOM.eventModalOverlay.classList.remove('active');
  DOM.eventForm.reset();
  currentEditingEventId = null;
  // Reset color picker to default
  selectColorSwatch(DEFAULT_EVENT_COLOR);
}

/**
 * Update the save button disabled state based on whether the title is non-empty.
 */
function updateSaveButtonState() {
  var title = DOM.eventTitleInput.value.trim();
  DOM.btnSaveEvent.disabled = (title.length === 0);
}

/**
 * Select a color swatch by color value, updating the visual state and hidden input.
 * @param {string} color – hex color string
 */
function selectColorSwatch(color) {
  var swatches = DOM.eventColorPicker.querySelectorAll('.color-swatch');
  var found = false;
  swatches.forEach(function (s) {
    if (s.getAttribute('data-color') === color) {
      s.classList.add('selected');
      found = true;
    } else {
      s.classList.remove('selected');
    }
  });
  // If the color is not one of the presets, select the first swatch
  if (!found && swatches.length > 0) {
    swatches[0].classList.add('selected');
    color = swatches[0].getAttribute('data-color');
  }
  DOM.eventColorInput.value = color;
}

/**
 * Open the event modal in edit mode, pre-filling all fields from an existing event.
 * @param {string} eventId
 */
function openEditModal(eventId) {
  var evt = events.find(function (e) { return e.id === eventId; });
  if (!evt) return;

  currentEditingEventId = eventId;
  DOM.modalTitle.textContent = 'Edit Event';
  DOM.btnDeleteEvent.style.display = 'inline-block';

  // Fill form fields
  DOM.eventTitleInput.value = evt.title;
  DOM.eventDescInput.value = evt.description || '';
  DOM.eventDateInput.value = evt.date;
  DOM.eventStartInput.value = evt.startTime;
  DOM.eventEndInput.value = evt.endTime;

  // Set color
  selectColorSwatch(evt.color || DEFAULT_EVENT_COLOR);

  openEventModal();
  setTimeout(function () {
    DOM.eventTitleInput.focus();
  }, 50);
}

/**
 * Handle saving an event (create or update).
 * Snaps start/end times to the nearest 30-minute grid boundary and
 * validates that endTime is strictly after startTime before saving.
 */
function handleEventSave() {
  var title = DOM.eventTitleInput.value.trim();
  if (!title) return; // safety check

  var date = DOM.eventDateInput.value;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    showToast('Please select a valid date.', 'error');
    return;
  }

  // Snap times to nearest 30-minute boundary
  var startTime = snapTimeTo30Min(DOM.eventStartInput.value, false);
  var endTime = snapTimeTo30Min(DOM.eventEndInput.value, true);

  // Validate: endTime must be strictly after startTime
  if (endTime <= startTime) {
    showToast('End time must be after start time.', 'error');
    return;
  }

  var eventData = {
    title: title,
    description: DOM.eventDescInput.value.trim(),
    date: date,
    startTime: startTime,
    endTime: endTime,
    color: DOM.eventColorInput.value || DEFAULT_EVENT_COLOR
  };

  if (currentEditingEventId) {
    // Update existing event
    var idx = events.findIndex(function (e) { return e.id === currentEditingEventId; });
    if (idx !== -1) {
      events[idx] = Object.assign({}, events[idx], eventData);
    }
  } else {
    // Create new event
    eventData.id = generateId();
    events.push(eventData);
  }

  closeEventModal();
  renderEvents();
  saveToLocalStorage();
}

/**
 * Handle deleting an event.
 * @param {string} eventId
 */
function handleEventDelete(eventId) {
  events = events.filter(function (e) { return e.id !== eventId; });
  closeEventModal();
  renderEvents();
  saveToLocalStorage();
}

function openExportModal() {
  DOM.exportModalOverlay.classList.add('active');
}

function closeExportModal() {
  DOM.exportModalOverlay.classList.remove('active');
  DOM.exportForm.reset();
}

/**
 * Open the export modal with sensible default dates.
 * Start date defaults to 30 days ago; end date defaults to today.
 * No date restrictions — both past and future events can be exported.
 */
function openExportModalWithDefaults() {
  var today = new Date();
  var thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Remove any max restriction so future dates are allowed
  DOM.exportStartDate.removeAttribute('max');
  DOM.exportEndDate.removeAttribute('max');

  DOM.exportEndDate.value = formatDateToISO(today);
  DOM.exportStartDate.value = formatDateToISO(thirtyDaysAgo);

  openExportModal();
}

/**
 * Format a Date object to "YYYY-MM-DD" string.
 * @param {Date} date
 * @returns {string}
 */
function formatDateToISO(date) {
  var yyyy = date.getFullYear();
  var mm = String(date.getMonth() + 1).padStart(2, '0');
  var dd = String(date.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

/**
 * Handle the Export TXT action.
 * Validates the date range, filters events, formats them as plain text,
 * and triggers a .txt file download.
 */
function handleExportTxt() {
  var startDateStr = DOM.exportStartDate.value;
  var endDateStr = DOM.exportEndDate.value;

  if (!startDateStr || !endDateStr) {
    showToast('Please select both start and end dates.', 'error');
    return;
  }

  // Validate: start date must not be after end date
  if (startDateStr > endDateStr) {
    showToast('Start date cannot be later than end date.', 'error');
    return;
  }

  // Filter events whose date falls within [startDate, endDate]
  var filtered = events.filter(function (evt) {
    return evt.date >= startDateStr && evt.date <= endDateStr;
  });

  if (filtered.length === 0) {
    showToast('No events found in the selected date range.', 'info');
    return;
  }

  // Group events by date
  var grouped = {};
  filtered.forEach(function (evt) {
    if (!grouped[evt.date]) {
      grouped[evt.date] = [];
    }
    grouped[evt.date].push(evt);
  });

  // Sort dates chronologically
  var sortedDates = Object.keys(grouped).sort();

  // Within each date group, sort by start time
  sortedDates.forEach(function (dateKey) {
    grouped[dateKey].sort(function (a, b) {
      return a.startTime.localeCompare(b.startTime);
    });
  });

  // Build plain text output
  var lines = [];
  lines.push('Calendar Export');
  lines.push('Date Range: ' + formatExportDate(startDateStr) + ' to ' + formatExportDate(endDateStr));
  lines.push('Total Events: ' + filtered.length);
  lines.push('');
  lines.push('========================================');

  sortedDates.forEach(function (dateKey) {
    lines.push('');
    lines.push('--- ' + formatExportDate(dateKey) + ' ---');
    lines.push('');

    grouped[dateKey].forEach(function (evt) {
      lines.push('  ' + evt.startTime + ' - ' + evt.endTime + '  ' + evt.title);
      if (evt.description) {
        lines.push('    ' + evt.description);
      }
    });
  });

  lines.push('');
  lines.push('========================================');
  lines.push('Exported on ' + formatExportDate(formatDateToISO(new Date())));

  var textContent = lines.join('\n');

  // Generate filename with date range: calendar-export-YYYYMMDD-YYYYMMDD.txt
  var fileStartDate = startDateStr.replace(/-/g, '');
  var fileEndDate = endDateStr.replace(/-/g, '');
  var filename = 'calendar-export-' + fileStartDate + '-' + fileEndDate + '.txt';

  // Create Blob and trigger download
  var blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(function () {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);

  closeExportModal();
  showToast('Exported ' + filtered.length + ' events to ' + filename, 'success');
}

/**
 * Format a "YYYY-MM-DD" date string into a more readable format for the export file.
 * Returns a string like "Mon, Mar 23, 2026".
 * @param {string} dateStr – "YYYY-MM-DD"
 * @returns {string}
 */
function formatExportDate(dateStr) {
  var parts = dateStr.split('-');
  var year = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10) - 1;
  var day = parseInt(parts[2], 10);
  var d = new Date(year, month, day);

  var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return dayNames[d.getDay()] + ', ' + monthNames[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

// ============================================================
// Drag-to-Create Interaction
// ============================================================

/** Drag state */
const dragState = {
  active: false,
  dayIndex: -1,         // 0-based column index
  startSlot: -1,        // slot index where mousedown occurred
  currentSlot: -1,      // slot index under current mouse position
  hasMoved: false,       // true if mouse moved to a different slot during drag
  previewEl: null,       // the preview DOM element
  scrollInterval: null   // interval id for edge-scrolling
};

/**
 * Pending single-click timer id. When mouseup fires without a real drag,
 * we delay opening the modal so that a subsequent dblclick can cancel it.
 */
let pendingClickTimer = null;

const SLOT_HEIGHT = 30;  // px per 30-min slot
const TOTAL_SLOTS = 48;  // 24h * 2
const EDGE_SCROLL_ZONE = 40; // px from top/bottom to trigger auto-scroll
const EDGE_SCROLL_SPEED = 6; // px per frame

/**
 * Convert a mouse Y position (relative to days-grid top) to a slot index,
 * snapped to the nearest slot boundary.
 * @param {number} yRelative – pixel offset from top of days-grid
 * @returns {number} slot index clamped to [0, TOTAL_SLOTS]
 */
function yToSlot(yRelative) {
  const slot = Math.round(yRelative / SLOT_HEIGHT);
  return Math.max(0, Math.min(TOTAL_SLOTS, slot));
}

/**
 * Determine which day-column index the mouse is over.
 * @param {number} xClient – clientX of the mouse event
 * @returns {number} 0-based day index, or -1 if outside
 */
function xToDayIndex(xClient) {
  for (let i = 0; i < DOM.dayColumns.length; i++) {
    const rect = DOM.dayColumns[i].getBoundingClientRect();
    if (xClient >= rect.left && xClient < rect.right) {
      return i;
    }
  }
  return -1;
}

/**
 * Get the Y position relative to the days-grid top (accounting for scroll).
 * @param {MouseEvent} e
 * @returns {number}
 */
function getRelativeY(e) {
  const gridRect = DOM.daysGrid.getBoundingClientRect();
  return e.clientY - gridRect.top;
}

/**
 * Create or update the drag preview element, including the time hint text.
 */
function updateDragPreview() {
  if (!dragState.active) return;

  const minSlot = Math.min(dragState.startSlot, dragState.currentSlot);
  const maxSlot = Math.max(dragState.startSlot, dragState.currentSlot);

  // Enforce minimum 1-slot (30 min) selection
  const endSlot = Math.max(maxSlot, minSlot + 1);

  const top = minSlot * SLOT_HEIGHT;
  const height = (endSlot - minSlot) * SLOT_HEIGHT;

  if (!dragState.previewEl) {
    dragState.previewEl = document.createElement('div');
    dragState.previewEl.className = 'drag-preview';
    // Add time hint element inside the preview
    var hintEl = document.createElement('div');
    hintEl.className = 'drag-time-hint';
    dragState.previewEl.appendChild(hintEl);
    DOM.dayColumns[dragState.dayIndex].appendChild(dragState.previewEl);
  }

  dragState.previewEl.style.top = top + 'px';
  dragState.previewEl.style.height = height + 'px';

  // Update the time hint text
  var hintEl = dragState.previewEl.querySelector('.drag-time-hint');
  if (hintEl) {
    hintEl.textContent = slotToTimeString(minSlot) + ' \u2013 ' + slotToTimeString(endSlot);
  }
}

/**
 * Remove the preview element and reset drag state.
 */
function cleanupDrag() {
  if (dragState.previewEl && dragState.previewEl.parentNode) {
    dragState.previewEl.parentNode.removeChild(dragState.previewEl);
  }
  dragState.previewEl = null;
  dragState.active = false;
  dragState.dayIndex = -1;
  dragState.startSlot = -1;
  dragState.currentSlot = -1;
  dragState.hasMoved = false;

  // Remove is-dragging class
  const calGrid = document.querySelector('.calendar-grid');
  if (calGrid) calGrid.classList.remove('is-dragging');

  // Stop edge scrolling
  stopEdgeScroll();
}

/**
 * Start auto-scrolling when the mouse is near the top or bottom edge of
 * the scroll container.
 * @param {MouseEvent} e
 */
function handleEdgeScroll(e) {
  const scrollRect = DOM.calendarScroll.getBoundingClientRect();
  const distFromTop = e.clientY - scrollRect.top;
  const distFromBottom = scrollRect.bottom - e.clientY;

  stopEdgeScroll();

  if (distFromTop < EDGE_SCROLL_ZONE && distFromTop >= 0) {
    // Scroll up
    dragState.scrollInterval = setInterval(function () {
      DOM.calendarScroll.scrollTop -= EDGE_SCROLL_SPEED;
    }, 16);
  } else if (distFromBottom < EDGE_SCROLL_ZONE && distFromBottom >= 0) {
    // Scroll down
    dragState.scrollInterval = setInterval(function () {
      DOM.calendarScroll.scrollTop += EDGE_SCROLL_SPEED;
    }, 16);
  }
}

function stopEdgeScroll() {
  if (dragState.scrollInterval !== null) {
    clearInterval(dragState.scrollInterval);
    dragState.scrollInterval = null;
  }
}

/**
 * Convert a slot index to a time string "HH:MM".
 * @param {number} slot
 * @returns {string}
 */
function slotToTimeString(slot) {
  const totalMinutes = slot * 30;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

/**
 * Open the event modal pre-filled with the date/time from a drag selection.
 * @param {number} dayIndex
 * @param {number} startSlot
 * @param {number} endSlot
 */
function openModalFromDrag(dayIndex, startSlot, endSlot) {
  currentEditingEventId = null;

  const date = addDays(currentWeekStart, dayIndex);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dateStr = yyyy + '-' + mm + '-' + dd;

  DOM.eventDateInput.value = dateStr;
  DOM.eventStartInput.value = slotToTimeString(startSlot);
  DOM.eventEndInput.value = slotToTimeString(endSlot);
  DOM.modalTitle.textContent = 'New Event';
  DOM.btnDeleteEvent.style.display = 'none';

  // Reset color to default
  selectColorSwatch(DEFAULT_EVENT_COLOR);

  openEventModal();
  // Focus the title input after modal is visible
  setTimeout(function () {
    DOM.eventTitleInput.focus();
  }, 50);
}

/**
 * Bind drag-to-create event handlers on the days-grid.
 */
function bindDragToCreate() {
  DOM.daysGrid.addEventListener('mousedown', onDragMouseDown);
  document.addEventListener('mousemove', onDragMouseMove);
  document.addEventListener('mouseup', onDragMouseUp);
}

function onDragMouseDown(e) {
  // Only left mouse button
  if (e.button !== 0) return;

  // Do not start drag if a modal is open
  if (isAnyModalOpen()) return;

  // Do not start drag if clicking on an existing event block
  if (e.target.closest('.event-block')) return;

  // Determine which column was clicked
  const dayIndex = xToDayIndex(e.clientX);
  if (dayIndex < 0) return;

  e.preventDefault();

  const relativeY = getRelativeY(e);
  const slot = yToSlot(relativeY);

  dragState.active = true;
  dragState.dayIndex = dayIndex;
  dragState.startSlot = slot;
  dragState.currentSlot = slot;
  dragState.hasMoved = false;

  // Add is-dragging class to prevent text selection
  const calGrid = document.querySelector('.calendar-grid');
  if (calGrid) calGrid.classList.add('is-dragging');

  updateDragPreview();
}

function onDragMouseMove(e) {
  if (!dragState.active) return;

  e.preventDefault();

  // Check if mouse has left the grid area horizontally
  const gridRect = DOM.daysGrid.getBoundingClientRect();
  if (e.clientX < gridRect.left || e.clientX > gridRect.right) {
    // Mouse left the grid horizontally – keep current slot but stop edge scrolling
    stopEdgeScroll();
    return;
  }

  const relativeY = getRelativeY(e);
  const slot = yToSlot(relativeY);

  // Clamp slot within bounds
  var clampedSlot = Math.max(0, Math.min(TOTAL_SLOTS, slot));
  if (clampedSlot !== dragState.startSlot) {
    dragState.hasMoved = true;
  }
  dragState.currentSlot = clampedSlot;

  updateDragPreview();
  handleEdgeScroll(e);
}

function onDragMouseUp(e) {
  if (!dragState.active) return;

  e.preventDefault();

  const relativeY = getRelativeY(e);
  const slot = yToSlot(relativeY);
  dragState.currentSlot = Math.max(0, Math.min(TOTAL_SLOTS, slot));

  // Determine final start/end (handle upward drag)
  let startSlot = Math.min(dragState.startSlot, dragState.currentSlot);
  let endSlot = Math.max(dragState.startSlot, dragState.currentSlot);

  // Enforce minimum 1-slot (30 min)
  if (endSlot <= startSlot) {
    endSlot = startSlot + 1;
  }

  // Clamp end to max
  endSlot = Math.min(endSlot, TOTAL_SLOTS);

  const dayIndex = dragState.dayIndex;
  const wasDragged = dragState.hasMoved;

  // Cleanup drag visuals
  cleanupDrag();

  if (wasDragged) {
    // Real drag – open modal immediately
    openModalFromDrag(dayIndex, startSlot, endSlot);
  } else {
    // Single click (no movement) – delay modal so dblclick can cancel it
    if (pendingClickTimer) clearTimeout(pendingClickTimer);
    pendingClickTimer = setTimeout(function () {
      pendingClickTimer = null;
      openModalFromDrag(dayIndex, startSlot, endSlot);
    }, 300);
  }
}

// ============================================================
// Modal Guard – prevent drag when modal is open
// ============================================================

/**
 * Returns true if any modal overlay is currently active (visible).
 * @returns {boolean}
 */
function isAnyModalOpen() {
  return DOM.eventModalOverlay.classList.contains('active') ||
         DOM.exportModalOverlay.classList.contains('active');
}

// ============================================================
// Keyboard Shortcuts
// ============================================================

/**
 * Bind global keyboard shortcuts:
 *  - ArrowLeft / ArrowRight: navigate weeks (only when no modal is open and
 *    focus is not inside an input/textarea)
 *  - Escape: close modals (already handled in bindModalEvents)
 */
function bindKeyboardShortcuts() {
  document.addEventListener('keydown', function (e) {
    // Ctrl+S / Cmd+S – download JSON backup
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleDownload();
      return;
    }

    // Skip if inside an input or textarea element
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    // Skip if a modal is open
    if (isAnyModalOpen()) return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      currentWeekStart = addDays(currentWeekStart, -7);
      renderWeek();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      currentWeekStart = addDays(currentWeekStart, 7);
      renderWeek();
    }
  });
}

// ============================================================
// Double-click to Quick-create Event
// ============================================================

/**
 * Bind double-click on the days-grid to quickly create a 30-minute event.
 */
function bindDoubleClickCreate() {
  DOM.daysGrid.addEventListener('dblclick', function (e) {
    // Cancel the pending single-click modal so it doesn't conflict
    if (pendingClickTimer) {
      clearTimeout(pendingClickTimer);
      pendingClickTimer = null;
    }

    // Do not trigger if double-clicking on an existing event block
    if (e.target.closest('.event-block')) return;

    // Do not trigger if a modal is already open (from a real drag, not from
    // the single-click path which we just cancelled above)
    if (isAnyModalOpen()) return;

    var dayIndex = xToDayIndex(e.clientX);
    if (dayIndex < 0) return;

    var relativeY = getRelativeY(e);
    var slot = yToSlot(relativeY);
    slot = Math.max(0, Math.min(TOTAL_SLOTS - 1, slot)); // ensure room for 30 min

    var endSlot = Math.min(slot + 1, TOTAL_SLOTS); // 30 minutes = 1 slot

    openModalFromDrag(dayIndex, slot, endSlot);
  });
}

// ============================================================
// Window Resize Handling
// ============================================================

/**
 * Handle window resize events.
 * Re-renders events (since overlap column widths are percentage-based,
 * the browser handles most of it, but we re-render to be safe) and
 * updates the current time line position.
 */
function bindResizeHandler() {
  var resizeTimeout = null;
  window.addEventListener('resize', function () {
    // Debounce resize to avoid excessive re-renders
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function () {
      renderEvents();
      updateCurrentTimeLine();
    }, 150);
  });
}

// ============================================================
// Bootstrap
// ============================================================

document.addEventListener('DOMContentLoaded', init);
