// AKO Stock Take desk helpers
frappe.provide("ako_stock_take");

ako_stock_take.format_variance = function (value) {
  const v = flt(value);
  if (v > 0) return `<span class="ako-stock-take-badge ako-variance-positive">+${v}</span>`;
  if (v < 0) return `<span class="ako-stock-take-badge ako-variance-negative">${v}</span>`;
  return `<span class="ako-stock-take-badge ako-variance-zero">0</span>`;
};
