# Copyright (c) 2026, Justin Msengi / Koda Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class StockTakeSettings(Document):
	def validate(self):
		if self.create_stock_reconciliation and not self.default_expense_account:
			frappe.msgprint(
				"Set a Default Difference Account when Stock Reconciliation on Submit is enabled.",
				indicator="orange",
				alert=True,
			)


@frappe.whitelist()
def get_settings():
	"""Return settings dict for mobile / desk consumers."""
	if not frappe.db.exists("Stock Take Settings", "Stock Take Settings"):
		from ako_stock_take.install import ensure_settings

		ensure_settings()

	doc = frappe.get_single("Stock Take Settings")
	logo = doc.app_logo
	if not logo and doc.company:
		logo = frappe.db.get_value("Company", doc.company, "company_logo")

	# Fallback to website / navbar logo
	if not logo:
		logo = frappe.db.get_single_value("Website Settings", "app_logo") or frappe.db.get_single_value(
			"Navbar Settings", "app_logo"
		)

	return {
		"company": doc.company,
		"app_logo": logo,
		"require_variance_reason": 1 if doc.require_variance_reason else 0,
		"allow_negative_stock_count": 1 if doc.allow_negative_stock_count else 0,
		"auto_fetch_balance": 1 if doc.auto_fetch_balance else 0,
		"enable_offline_sync": 1 if doc.enable_offline_sync else 0,
		"default_scan_mode": doc.default_scan_mode or "Barcode",
		"allow_manual_item_search": 1 if doc.allow_manual_item_search else 0,
		"duplicate_scan_behavior": doc.duplicate_scan_behavior or "Accumulate",
		"lock_actual_balance": 1 if doc.lock_actual_balance else 0,
		"show_system_balance_on_device": 1 if doc.show_system_balance_on_device else 0,
		"create_stock_reconciliation": 1 if doc.create_stock_reconciliation else 0,
		"mobile_app_title": doc.mobile_app_title or "AKO Stock Take",
		"support_email": doc.support_email,
		"support_phone": doc.support_phone,
	}
