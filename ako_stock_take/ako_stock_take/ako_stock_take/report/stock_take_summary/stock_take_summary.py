# Copyright (c) 2026, Justin Msengi / Koda Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe import _


def execute(filters=None):
	filters = filters or {}
	columns = get_columns()
	data = get_data(filters)
	return columns, data


def get_columns():
	return [
		{"label": _("Session"), "fieldname": "name", "fieldtype": "Link", "options": "Stock Take Session", "width": 160},
		{"label": _("Date"), "fieldname": "posting_date", "fieldtype": "Date", "width": 100},
		{"label": _("Warehouse"), "fieldname": "warehouse", "fieldtype": "Link", "options": "Warehouse", "width": 160},
		{"label": _("Company"), "fieldname": "company", "fieldtype": "Link", "options": "Company", "width": 140},
		{"label": _("Status"), "fieldname": "status", "fieldtype": "Data", "width": 110},
		{"label": _("Stock Take By"), "fieldname": "stock_take_by", "fieldtype": "Link", "options": "User", "width": 150},
		{"label": _("Total Items"), "fieldname": "total_items", "fieldtype": "Int", "width": 100},
		{"label": _("Counted"), "fieldname": "items_counted", "fieldtype": "Int", "width": 90},
		{"label": _("With Variance"), "fieldname": "items_with_variance", "fieldtype": "Int", "width": 110},
		{"label": _("Variance Qty"), "fieldname": "total_variance_qty", "fieldtype": "Float", "width": 110},
		{"label": _("Variance Value"), "fieldname": "total_variance_value", "fieldtype": "Currency", "width": 130},
	]


def get_data(filters):
	conditions = ["1=1"]
	values = {}
	if filters.get("company"):
		conditions.append("company = %(company)s")
		values["company"] = filters["company"]
	if filters.get("warehouse"):
		conditions.append("warehouse = %(warehouse)s")
		values["warehouse"] = filters["warehouse"]
	if filters.get("from_date"):
		conditions.append("posting_date >= %(from_date)s")
		values["from_date"] = filters["from_date"]
	if filters.get("to_date"):
		conditions.append("posting_date <= %(to_date)s")
		values["to_date"] = filters["to_date"]
	if filters.get("status"):
		conditions.append("status = %(status)s")
		values["status"] = filters["status"]

	return frappe.db.sql(
		f"""
		SELECT name, posting_date, warehouse, company, status, stock_take_by,
		       total_items, items_counted, items_with_variance,
		       total_variance_qty, total_variance_value
		FROM `tabStock Take Session`
		WHERE {" AND ".join(conditions)}
		ORDER BY posting_date DESC, modified DESC
		""",
		values,
		as_dict=True,
	)


def get_filters():
	return [
		{"fieldname": "company", "label": _("Company"), "fieldtype": "Link", "options": "Company"},
		{"fieldname": "warehouse", "label": _("Warehouse"), "fieldtype": "Link", "options": "Warehouse"},
		{"fieldname": "from_date", "label": _("From Date"), "fieldtype": "Date"},
		{"fieldname": "to_date", "label": _("To Date"), "fieldtype": "Date"},
		{
			"fieldname": "status",
			"label": _("Status"),
			"fieldtype": "Select",
			"options": "\nDraft\nIn Progress\nSubmitted\nCancelled\nClosed",
		},
	]
