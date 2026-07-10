# Copyright (c) 2026, Justin Msengi / Koda Technologies and contributors
# For license information, please see license.txt
"""Items with variance but missing mandatory reason – accountability exceptions."""

import frappe
from frappe import _


def execute(filters=None):
	filters = filters or {}
	columns = [
		{"label": _("Session"), "fieldname": "parent", "fieldtype": "Link", "options": "Stock Take Session", "width": 150},
		{"label": _("Status"), "fieldname": "status", "fieldtype": "Data", "width": 100},
		{"label": _("Warehouse"), "fieldname": "warehouse", "fieldtype": "Link", "options": "Warehouse", "width": 140},
		{"label": _("Item Code"), "fieldname": "item_code", "fieldtype": "Link", "options": "Item", "width": 130},
		{"label": _("Item Name"), "fieldname": "item_name", "fieldtype": "Data", "width": 180},
		{"label": _("Actual Balance"), "fieldname": "actual_balance", "fieldtype": "Float", "width": 120},
		{"label": _("Physical Qty"), "fieldname": "physical_qty", "fieldtype": "Float", "width": 110},
		{"label": _("Variance"), "fieldname": "variance", "fieldtype": "Float", "width": 100},
		{"label": _("User"), "fieldname": "scanned_by", "fieldtype": "Link", "options": "User", "width": 130},
		{"label": _("Exception"), "fieldname": "exception_type", "fieldtype": "Data", "width": 200},
	]

	conditions = [
		"sts.docstatus < 2",
		"sti.variance != 0",
		"(sti.reason_for_variance IS NULL OR sti.reason_for_variance = '')",
	]
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

	data = frappe.db.sql(
		f"""
		SELECT
			sti.parent, sts.status, COALESCE(sti.warehouse, sts.warehouse) AS warehouse,
			sti.item_code, sti.item_name, sti.actual_balance, sti.physical_qty,
			sti.variance, sti.scanned_by,
			'Missing Variance Reason' AS exception_type
		FROM `tabStock Take Item` sti
		INNER JOIN `tabStock Take Session` sts ON sts.name = sti.parent
		WHERE {" AND ".join(conditions)}
		ORDER BY ABS(sti.variance) DESC
		""",
		values,
		as_dict=True,
	)
	return columns, data
