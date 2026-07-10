# Copyright (c) 2026, Justin Msengi / Koda Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, now_datetime, nowdate, nowtime, get_datetime


class StockTakeSession(Document):
	def validate(self):
		self.set_title()
		self.calculate_totals()
		self.validate_variance_reasons()
		self.validate_negative_qty()

	def before_insert(self):
		if not self.started_at:
			self.started_at = now_datetime()
		if not self.posting_date:
			self.posting_date = nowdate()
		if not self.posting_time:
			self.posting_time = nowtime()
		if not self.stock_take_by:
			self.stock_take_by = frappe.session.user
		if not self.company:
			self.company = frappe.db.get_single_value("Stock Take Settings", "company") or frappe.defaults.get_user_default(
				"Company"
			)
		self.status = self.status or "Draft"

	def before_submit(self):
		self.calculate_totals()
		self.validate_variance_reasons(strict=True)
		if not self.items:
			frappe.throw(_("Cannot submit a Stock Take Session with no counted items."))
		self.status = "Submitted"
		self.completed_at = now_datetime()

	def on_submit(self):
		settings = frappe.get_single("Stock Take Settings")
		if settings.create_stock_reconciliation:
			self.create_stock_reconciliation_doc(settings)

	def on_cancel(self):
		self.status = "Cancelled"
		if self.stock_reconciliation:
			try:
				reco = frappe.get_doc("Stock Reconciliation", self.stock_reconciliation)
				if reco.docstatus == 1:
					reco.cancel()
			except Exception:
				frappe.log_error(frappe.get_traceback(), "Stock Take Cancel Reconciliation")

	def set_title(self):
		if not self.title:
			wh = self.warehouse or ""
			self.title = f"Stock Take – {wh} – {self.posting_date or nowdate()}"

	def calculate_totals(self):
		total_items = 0
		items_counted = 0
		items_with_variance = 0
		total_variance_qty = 0.0
		total_variance_value = 0.0

		for row in self.items or []:
			total_items += 1
			row.actual_balance = flt(row.actual_balance)
			row.physical_qty = flt(row.physical_qty)
			row.variance = flt(row.physical_qty) - flt(row.actual_balance)
			row.valuation_rate = flt(row.valuation_rate)
			row.variance_value = flt(row.variance) * flt(row.valuation_rate)

			if row.is_counted or row.physical_qty is not None:
				items_counted += 1

			if flt(row.variance) != 0:
				items_with_variance += 1

			total_variance_qty += flt(row.variance)
			total_variance_value += flt(row.variance_value)

			if not row.warehouse:
				row.warehouse = self.warehouse
			if not row.scanned_by:
				row.scanned_by = frappe.session.user
			if not row.scanned_at:
				row.scanned_at = now_datetime()

		self.total_items = total_items
		self.items_counted = items_counted
		self.items_with_variance = items_with_variance
		self.total_variance_qty = total_variance_qty
		self.total_variance_value = total_variance_value

		if self.docstatus == 0 and total_items > 0 and self.status == "Draft":
			self.status = "In Progress"

	def validate_variance_reasons(self, strict=False):
		require = frappe.db.get_single_value("Stock Take Settings", "require_variance_reason")
		if not require and not strict:
			return
		if not require:
			return

		missing = []
		for idx, row in enumerate(self.items or [], start=1):
			if flt(row.variance) != 0 and not row.reason_for_variance:
				missing.append(f"Row #{idx}: {row.item_code or row.item_name or 'Item'}")

		if missing:
			frappe.throw(
				_("Reason for Variance is mandatory when variance is not zero.<br><br>{0}").format(
					"<br>".join(missing)
				),
				title=_("Variance Reason Required"),
			)

	def validate_negative_qty(self):
		allow_neg = frappe.db.get_single_value("Stock Take Settings", "allow_negative_stock_count")
		if allow_neg:
			return
		for idx, row in enumerate(self.items or [], start=1):
			if flt(row.physical_qty) < 0:
				frappe.throw(_("Row #{0}: Physical Quantity cannot be negative.").format(idx))

	def create_stock_reconciliation_doc(self, settings=None):
		settings = settings or frappe.get_single("Stock Take Settings")
		if not self.items:
			return

		items = []
		for row in self.items:
			items.append(
				{
					"item_code": row.item_code,
					"warehouse": row.warehouse or self.warehouse,
					"qty": flt(row.physical_qty),
					"valuation_rate": flt(row.valuation_rate) or None,
					"batch_no": row.batch_no,
				}
			)

		if not items:
			return

		reco = frappe.get_doc(
			{
				"doctype": "Stock Reconciliation",
				"company": self.company,
				"purpose": "Stock Reconciliation",
				"posting_date": self.posting_date or nowdate(),
				"posting_time": self.posting_time or nowtime(),
				"expense_account": settings.default_expense_account,
				"cost_center": settings.default_cost_center,
				"items": items,
			}
		)
		reco.insert(ignore_permissions=True)
		if settings.auto_submit_reconciliation:
			reco.submit()

		self.db_set("stock_reconciliation", reco.name)
		frappe.msgprint(_("Stock Reconciliation {0} created").format(frappe.bold(reco.name)), alert=True)
