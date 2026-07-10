# Copyright (c) 2026, Justin Msengi / Koda Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe import _


def execute(filters=None):
	filters = filters or {}
	columns = [
		{"label": _("Session"), "fieldname": "parent", "fieldtype": "Link", "options": "Stock Take Session", "width": 150},
		{"label": _("Date"), "fieldname": "posting_date", "fieldtype": "Date", "width": 100},
		{"label": _("Warehouse"), "fieldname": "warehouse", "fieldtype": "Link", "options": "Warehouse", "width": 140},
		{"label": _("Item Code"), "fieldname": "item_code", "fieldtype": "Link", "options": "Item", "width": 130},
		{"label": _("Item Name"), "fieldname": "item_name", "fieldtype": "Data", "width": 180},
		{"label": _("Barcode"), "fieldname": "barcode", "fieldtype": "Data", "width": 120},
		{"label": _("Actual Balance"), "fieldname": "actual_balance", "fieldtype": "Float", "width": 120},
		{"label": _("Physical Qty"), "fieldname": "physical_qty", "fieldtype": "Float", "width": 110},
		{"label": _("Variance"), "fieldname": "variance", "fieldtype": "Float", "width": 100},
		{"label": _("Variance Value"), "fieldname": "variance_value", "fieldtype": "Currency", "width": 120},
		{"label": _("Reason"), "fieldname": "reason_for_variance", "fieldtype": "Link", "options": "Stock Take Variance Reason", "width": 150},
		{"label": _("User"), "fieldname": "scanned_by", "fieldtype": "Link", "options": "User", "width": 130},
		{"label": _("Date & Time"), "fieldname": "scanned_at", "fieldtype": "Datetime", "width": 150},
	]

	conditions = ["sti.variance != 0", "sts.docstatus < 2"]
	values = {}
	if filters.get("company"):
		conditions.append("sts.company = %(company)s")
		values["company"] = filters["company"]
	if filters.get("warehouse"):
		conditions.append("sts.warehouse = %(warehouse)s")
		values["warehouse"] = filters["warehouse"]
	if filters.get("from_date"):
		conditions.append("sts.posting_date >= %(from_date)s")
		values["from_date"] = filters["from_date"]
	if filters.get("to_date"):
		conditions.append("sts.posting_date <= %(to_date)s")
		values["to_date"] = filters["to_date"]
	if filters.get("session"):
		conditions.append("sts.name = %(session)s")
		values["session"] = filters["session"]
	if filters.get("item_code"):
		conditions.append("sti.item_code = %(item_code)s")
		values["item_code"] = filters["item_code"]
	if filters.get("only_submitted"):
		conditions.append("sts.docstatus = 1")

	data = frappe.db.sql(
		f"""
		SELECT
			sti.parent, sts.posting_date, COALESCE(sti.warehouse, sts.warehouse) AS warehouse,
			sti.item_code, sti.item_name, sti.barcode,
			sti.actual_balance, sti.physical_qty, sti.variance, sti.variance_value,
			sti.reason_for_variance, sti.scanned_by, sti.scanned_at
		FROM `tabStock Take Item` sti
		INNER JOIN `tabStock Take Session` sts ON sts.name = sti.parent
		WHERE {" AND ".join(conditions)}
		ORDER BY sts.posting_date DESC, ABS(sti.variance) DESC
		""",
		values,
		as_dict=True,
	)
	return columns, data
