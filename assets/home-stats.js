/* Homepage hero counts: same #perf-data dataset used by the performance board. */
(function () {
  'use strict';
  try {
    const node = document.getElementById('perf-data');
    if (!node) return;
    const data = JSON.parse(node.textContent);
    const counts = data.branch_counts;
    const count = Array.isArray(counts) && Array.isArray(data.months) && counts.length === data.months.length ? counts[counts.length - 1] : null;
    if (!Number.isInteger(count) || count < 1) return;
    document.querySelectorAll('[data-hero-branches]').forEach((el) => { el.textContent = count.toLocaleString('ko-KR') + '개 본부'; });
    // count_total is contracts, not planners. No planner-count data exists; keep the current 1,200.
  } catch (e) { /* Keep the initial figures if the dataset cannot be read. */ }
})();
