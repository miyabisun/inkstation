<script lang="ts">
  import { holidays } from "$client/lib/holidays";
  import { getCurrentPageDate } from "$client/lib/date";

  interface Props {
    currentDate: string;
    noteDates: string[];
    onSelectDate: (date: string) => void;
    onClose: () => void;
  }

  let { currentDate, noteDates, onSelectDate, onClose }: Props = $props();

  const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

  // Intentionally captures initial value — month changes independently via nav buttons
  // svelte-ignore state_referenced_locally
  let displayedMonth = $state(currentDate.slice(0, 7));

  let displayedYear = $derived(parseInt(displayedMonth.split("-")[0], 10));
  let displayedMonthNum = $derived(parseInt(displayedMonth.split("-")[1], 10));

  let todayStr = $derived(getCurrentPageDate());

  let noteDateSet = $derived(new Set(noteDates));

  interface CalendarDay {
    date: string;
    day: number;
    isCurrentMonth: boolean;
  }

  let calendarGrid = $derived.by(() => {
    const year = displayedYear;
    const month = displayedMonthNum;

    // First day of the month
    const firstDay = new Date(year, month - 1, 1);
    const startDow = firstDay.getDay(); // 0=Sun

    // Days in the month
    const daysInMonth = new Date(year, month, 0).getDate();

    const days: CalendarDay[] = [];

    // Fill leading blanks from previous month
    const prevMonthDays = new Date(year, month - 1, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      days.push({
        date: `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        day: d,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        date: `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        day: d,
        isCurrentMonth: true,
      });
    }

    // Fill trailing blanks to complete the last week
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      for (let d = 1; d <= remaining; d++) {
        days.push({
          date: `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
          day: d,
          isCurrentMonth: false,
        });
      }
    }

    // Split into weeks
    const weeks: CalendarDay[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  });

  function prevMonth() {
    if (displayedMonthNum === 1) {
      displayedMonth = `${displayedYear - 1}-${String(12).padStart(2, "0")}`;
    } else {
      displayedMonth = `${displayedYear}-${String(displayedMonthNum - 1).padStart(2, "0")}`;
    }
  }

  function nextMonth() {
    if (displayedMonthNum === 12) {
      displayedMonth = `${displayedYear + 1}-01`;
    } else {
      displayedMonth = `${displayedYear}-${String(displayedMonthNum + 1).padStart(2, "0")}`;
    }
  }

  function isTappable(dateStr: string): boolean {
    if (dateStr > todayStr) return false;
    return noteDateSet.has(dateStr) || dateStr === todayStr;
  }

  function getDow(dateStr: string): number {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).getDay();
  }

  function handleDayClick(day: CalendarDay) {
    if (!day.isCurrentMonth) return;
    if (!isTappable(day.date)) return;
    onSelectDate(day.date);
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="calendar-overlay" onclick={handleOverlayClick}>
  <div class="calendar">
    <div class="calendar-header">
      <button class="nav-btn" onclick={prevMonth} aria-label="前月">◀</button>
      <span class="month-label">{displayedYear}年{displayedMonthNum}月</span>
      <button class="nav-btn" onclick={nextMonth} aria-label="翌月">▶</button>
    </div>

    <div class="weekday-row">
      {#each WEEKDAY_LABELS as label, i}
        <span
          class="weekday-label"
          class:sunday={i === 0}
          class:saturday={i === 6}
        >
          {label}
        </span>
      {/each}
    </div>

    {#each calendarGrid as week}
      <div class="week-row">
        {#each week as day}
          {@const holiday = holidays[day.date]}
          {@const dow = getDow(day.date)}
          {@const tappable = day.isCurrentMonth && isTappable(day.date)}
          {@const isSelected = day.date === currentDate}
          {@const hasNote = noteDateSet.has(day.date)}
          <button
            class="day-cell"
            class:other-month={!day.isCurrentMonth}
            class:selected={isSelected && day.isCurrentMonth}
            class:today={day.date === todayStr && day.isCurrentMonth}
            class:holiday={!!holiday && day.isCurrentMonth}
            class:sunday={dow === 0 && day.isCurrentMonth}
            class:saturday={dow === 6 && day.isCurrentMonth}
            class:tappable
            disabled={!tappable}
            onclick={() => handleDayClick(day)}
            aria-label={day.date}
          >
            <span class="day-number">{day.day}</span>
            {#if hasNote && day.isCurrentMonth}
              <span class="note-marker">📝</span>
            {/if}
            {#if holiday && day.isCurrentMonth}
              <span class="holiday-name">{holiday}</span>
            {/if}
          </button>
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .calendar-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    display: flex;
    justify-content: flex-start;
    align-items: flex-start;
    padding-top: 48px;
    padding-left: 12px;
  }

  .calendar {
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    padding: 12px;
    min-width: 320px;
    max-width: 380px;
    user-select: none;
  }

  .calendar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .month-label {
    font-size: 16px;
    font-weight: bold;
  }

  .nav-btn {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    color: #333;
  }

  .nav-btn:hover {
    background: #f0f0f0;
  }

  .weekday-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    text-align: center;
    margin-bottom: 4px;
    font-size: 12px;
    font-weight: bold;
    color: #666;
  }

  .weekday-label.sunday {
    color: #d32f2f;
  }

  .weekday-label.saturday {
    color: #1565c0;
  }

  .week-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
  }

  .day-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 4px 2px;
    min-height: 44px;
    border: none;
    background: none;
    cursor: default;
    font-size: 14px;
    border-radius: 4px;
    position: relative;
    color: #333;
  }

  .day-cell.other-month {
    color: #ccc;
  }

  .day-cell.sunday .day-number,
  .day-cell.holiday .day-number {
    color: #d32f2f;
  }

  .day-cell.saturday .day-number {
    color: #1565c0;
  }

  .day-cell.tappable {
    cursor: pointer;
  }

  .day-cell.tappable:hover {
    background: #f5f5f5;
  }

  .day-cell.selected {
    background: #e3f2fd;
    border-radius: 4px;
  }

  .day-cell.today .day-number {
    background: #1976d2;
    color: #fff !important;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .day-cell:disabled {
    opacity: 0.5;
  }

  .day-cell.tappable:disabled {
    opacity: 1;
  }

  .day-number {
    line-height: 1;
  }

  .note-marker {
    font-size: 10px;
    line-height: 1;
  }

  .holiday-name {
    font-size: 8px;
    color: #d32f2f;
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
</style>
