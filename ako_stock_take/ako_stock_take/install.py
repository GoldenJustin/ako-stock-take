import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def after_install():
	create_roles()
	create_default_reasons()
	ensure_settings()
	create_item_custom_fields()
	frappe.clear_cache()


def after_migrate():
	create_roles()
	create_default_reasons()
	ensure_settings()
	create_item_custom_fields()


def create_roles():
	for role in ("Stock Take User", "Stock Take Manager"):
		if not frappe.db.exists("Role", role):
			doc = frappe.get_doc(
				{
					"doctype": "Role",
					"role_name": role,
					"desk_access": 1,
					"is_custom": 1,
				}
			)
			doc.insert(ignore_permissions=True)


def create_default_reasons():
	defaults = [
		{"reason_code": "DAMAGED", "reason_name": "Damaged Goods", "is_active": 1},
		{"reason_code": "THEFT", "reason_name": "Theft / Shrinkage", "is_active": 1},
		{"reason_code": "EXPIRED", "reason_name": "Expired Stock", "is_active": 1},
		{"reason_code": "MISCOUNT", "reason_name": "Previous Miscount", "is_active": 1},
		{"reason_code": "UNRECORDED_ISSUE", "reason_name": "Unrecorded Issue / Delivery", "is_active": 1},
		{"reason_code": "UNRECORDED_RECEIPT", "reason_name": "Unrecorded Receipt", "is_active": 1},
		{"reason_code": "TRANSFER", "reason_name": "Pending Transfer", "is_active": 1},
		{"reason_code": "OTHER", "reason_name": "Other (see notes)", "is_active": 1},
	]
	for row in defaults:
		if not frappe.db.exists("Stock Take Variance Reason", row["reason_code"]):
			if not frappe.db.exists("Stock Take Variance Reason", {"reason_name": row["reason_name"]}):
				doc = frappe.get_doc({"doctype": "Stock Take Variance Reason", **row})
				doc.insert(ignore_permissions=True)


def ensure_settings():
	if not frappe.db.exists("Stock Take Settings", "Stock Take Settings"):
		doc = frappe.get_doc(
			{
				"doctype": "Stock Take Settings",
				"name": "Stock Take Settings",
				"require_variance_reason": 1,
				"allow_negative_stock_count": 0,
				"auto_fetch_balance": 1,
				"default_scan_mode": "Barcode",
				"enable_offline_sync": 1,
			}
		)
		doc.insert(ignore_permissions=True)


def create_item_custom_fields():
	"""Optional helpers on Item for stock take readiness."""
	custom_fields = {
		"Item": [
			{
				"fieldname": "ako_stock_take_section",
				"fieldtype": "Section Break",
				"label": "AKO Stock Take",
				"insert_after": "barcodes",
				"collapsible": 1,
			},
			{
				"fieldname": "ako_stock_take_enabled",
				"fieldtype": "Check",
				"label": "Include in Stock Take",
				"default": "1",
				"insert_after": "ako_stock_take_section",
			},
			{
				"fieldname": "ako_last_stock_take_date",
				"fieldtype": "Datetime",
				"label": "Last Stock Take",
				"read_only": 1,
				"insert_after": "ako_stock_take_enabled",
			},
		]
	}
	create_custom_fields(custom_fields, update=True)
