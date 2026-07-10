# Copyright (c) 2026, Justin Msengi / Koda Technologies and contributors
# For license information, please see license.txt
"""
Mobile / REST API for AKO Stock Take.

Base: /api/method/ako_stock_take.api.stock_take.<method>
"""

from __future__ import annotations

import json
from typing import Any

import frappe
from frappe import _
from frappe.utils import cint, flt, get_url, now_datetime, nowdate, nowtime, get_datetime


def _require_login():
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required"), frappe.AuthenticationError)


def _absolute_url(path: str | None) -> str | None:
	if not path:
		return None
	if path.startswith("http://") or path.startswith("https://"):
		return path
	return get_url(path)


def _get_item_by_barcode(barcode: str) -> dict | None:
	barcode = (barcode or "").strip()
	if not barcode:
		return None

	# Item Barcode child table
	row = frappe.db.sql(
		"""
		SELECT parent AS item_code, barcode, uom
		FROM `tabItem Barcode`
		WHERE barcode = %s
		LIMIT 1
		""",
		barcode,
		as_dict=True,
	)
	if row:
		item_code = row[0].item_code
		item = frappe.db.get_value(
			"Item",
			item_code,
			["name", "item_name", "stock_uom", "is_stock_item", "disabled", "has_batch_no", "has_serial_no", "image"],
			as_dict=True,
		)
		if item:
			return {
				**item,
				"barcode": row[0].barcode,
				"barcode_uom": row[0].uom,
			}

	# Fallback: item_code equals barcode
	if frappe.db.exists("Item", barcode):
		item = frappe.db.get_value(
			"Item",
			barcode,
			["name", "item_name", "stock_uom", "is_stock_item", "disabled", "has_batch_no", "has_serial_no", "image"],
			as_dict=True,
		)
		if item:
			return {**item, "barcode": barcode, "barcode_uom": item.stock_uom}

	return None


def _get_bin_qty(item_code: str, warehouse: str) -> tuple[float, float]:
	"""Return (actual_qty, valuation_rate)."""
	bin_data = frappe.db.get_value(
		"Bin",
		{"item_code": item_code, "warehouse": warehouse},
		["actual_qty", "valuation_rate"],
		as_dict=True,
	)
	if bin_data:
		return flt(bin_data.actual_qty), flt(bin_data.valuation_rate)

	# Try stock balance API if available
	try:
		from erpnext.stock.utils import get_stock_balance

		qty = get_stock_balance(item_code, warehouse)
		rate = frappe.db.get_value("Item", item_code, "valuation_rate") or 0
		return flt(qty), flt(rate)
	except Exception:
		rate = frappe.db.get_value("Bin", {"item_code": item_code}, "valuation_rate") or 0
		return 0.0, flt(rate)


def _load_settings_dict() -> dict:
	"""Settings for mobile — does not import doctype controllers (path-safe)."""
	if not frappe.db.exists("DocType", "Stock Take Settings"):
		return {
			"company": frappe.defaults.get_user_default("Company"),
			"app_logo": None,
			"require_variance_reason": 1,
			"allow_negative_stock_count": 0,
			"auto_fetch_balance": 1,
			"enable_offline_sync": 1,
			"default_scan_mode": "Barcode",
			"allow_manual_item_search": 1,
			"duplicate_scan_behavior": "Accumulate",
			"lock_actual_balance": 1,
			"show_system_balance_on_device": 1,
			"create_stock_reconciliation": 0,
			"mobile_app_title": "AKO Stock Take",
			"support_email": None,
			"support_phone": None,
		}

	if not frappe.db.exists("Stock Take Settings", "Stock Take Settings"):
		try:
			from ako_stock_take.install import ensure_settings

			ensure_settings()
		except Exception:
			frappe.log_error(frappe.get_traceback(), "AKO Stock Take ensure_settings")

	# Prefer DB values (works even if controller import path is wrong)
	fields = [
		"company",
		"app_logo",
		"require_variance_reason",
		"allow_negative_stock_count",
		"auto_fetch_balance",
		"enable_offline_sync",
		"default_scan_mode",
		"allow_manual_item_search",
		"duplicate_scan_behavior",
		"lock_actual_balance",
		"show_system_balance_on_device",
		"create_stock_reconciliation",
		"mobile_app_title",
		"support_email",
		"support_phone",
	]
	row = {}
	try:
		row = frappe.db.get_value("Stock Take Settings", "Stock Take Settings", fields, as_dict=True) or {}
	except Exception:
		try:
			doc = frappe.get_single("Stock Take Settings")
			row = {f: doc.get(f) for f in fields}
		except Exception:
			row = {}

	logo = row.get("app_logo")
	company = row.get("company")
	if not logo and company:
		logo = frappe.db.get_value("Company", company, "company_logo")
	if not logo:
		try:
			logo = frappe.db.get_single_value("Website Settings", "app_logo") or frappe.db.get_single_value(
				"Navbar Settings", "app_logo"
			)
		except Exception:
			logo = None

	def flag(key, default=0):
		if key not in row or row.get(key) is None:
			return default
		return 1 if row.get(key) else 0

	return {
		"company": company,
		"app_logo": logo,
		"require_variance_reason": flag("require_variance_reason", 1),
		"allow_negative_stock_count": flag("allow_negative_stock_count", 0),
		"auto_fetch_balance": flag("auto_fetch_balance", 1),
		"enable_offline_sync": flag("enable_offline_sync", 1),
		"default_scan_mode": row.get("default_scan_mode") or "Barcode",
		"allow_manual_item_search": flag("allow_manual_item_search", 1),
		"duplicate_scan_behavior": row.get("duplicate_scan_behavior") or "Accumulate",
		"lock_actual_balance": flag("lock_actual_balance", 1),
		"show_system_balance_on_device": flag("show_system_balance_on_device", 1),
		"create_stock_reconciliation": flag("create_stock_reconciliation", 0),
		"mobile_app_title": row.get("mobile_app_title") or "AKO Stock Take",
		"support_email": row.get("support_email"),
		"support_phone": row.get("support_phone"),
	}


def _session_to_dict(doc) -> dict:
	return {
		"name": doc.name,
		"title": doc.title,
		"company": doc.company,
		"warehouse": doc.warehouse,
		"status": doc.status,
		"posting_date": str(doc.posting_date) if doc.posting_date else None,
		"posting_time": str(doc.posting_time) if doc.posting_time else None,
		"stock_take_by": doc.stock_take_by,
		"started_at": str(doc.started_at) if doc.started_at else None,
		"completed_at": str(doc.completed_at) if doc.completed_at else None,
		"total_items": doc.total_items,
		"items_counted": doc.items_counted,
		"items_with_variance": doc.items_with_variance,
		"total_variance_qty": doc.total_variance_qty,
		"total_variance_value": doc.total_variance_value,
		"remarks": doc.remarks,
		"docstatus": doc.docstatus,
		"stock_reconciliation": doc.stock_reconciliation,
		"items": [
			{
				"name": row.name,
				"idx": row.idx,
				"item_code": row.item_code,
				"item_name": row.item_name,
				"barcode": row.barcode,
				"uom": row.uom,
				"stock_uom": row.stock_uom,
				"warehouse": row.warehouse,
				"actual_balance": row.actual_balance,
				"physical_qty": row.physical_qty,
				"variance": row.variance,
				"variance_value": row.variance_value,
				"valuation_rate": row.valuation_rate,
				"reason_for_variance": row.reason_for_variance,
				"reason_notes": row.reason_notes,
				"scanned_at": str(row.scanned_at) if row.scanned_at else None,
				"scanned_by": row.scanned_by,
				"batch_no": row.batch_no,
				"serial_no": row.serial_no,
				"is_counted": row.is_counted,
			}
			for row in (doc.items or [])
		],
	}


@frappe.whitelist()
def ping():
	"""Health check."""
	return {"ok": True, "user": frappe.session.user, "app": "ako_stock_take", "version": "1.0.0"}


@frappe.whitelist()
def login(usr: str = None, pwd: str = None):
	"""
	Explicit login helper (also works with standard /api/method/login).
	Returns session info + branding.
	"""
	usr = usr or frappe.form_dict.get("usr")
	pwd = pwd or frappe.form_dict.get("pwd")
	if not usr or not pwd:
		frappe.throw(_("Username and password required"))

	frappe.local.login_manager.authenticate(usr, pwd)
	frappe.local.login_manager.post_login()

	return get_bootstrap()


@frappe.whitelist()
def get_bootstrap():
	"""Return user profile, settings, logo, warehouses, reasons – single call after login."""
	_require_login()
	settings = _load_settings_dict()
	user = frappe.session.user
	user_doc = frappe.get_cached_doc("User", user)

	warehouses = []
	try:
		warehouses = frappe.get_list(
			"Warehouse",
			filters={"is_group": 0, "disabled": 0},
			fields=["name", "warehouse_name", "company", "parent_warehouse"],
			order_by="name",
			limit_page_length=500,
		)
	except Exception:
		# permission fallback
		warehouses = frappe.db.get_all(
			"Warehouse",
			filters={"is_group": 0},
			fields=["name", "warehouse_name", "company", "parent_warehouse"],
			order_by="name",
			limit_page_length=500,
		)

	companies = frappe.get_list(
		"Company",
		fields=["name", "company_name", "abbr", "default_currency", "company_logo"],
		limit_page_length=50,
	) or []

	# Prefer company logo if settings has none
	if not settings.get("app_logo") and companies:
		default_company = settings.get("company") or frappe.defaults.get_user_default("Company")
		for c in companies:
			if c.name == default_company and c.get("company_logo"):
				settings["app_logo"] = c.get("company_logo")
				break
		if not settings.get("app_logo") and companies[0].get("company_logo"):
			settings["app_logo"] = companies[0]["company_logo"]

	settings["app_logo"] = _absolute_url(settings.get("app_logo"))
	for c in companies:
		c["company_logo"] = _absolute_url(c.get("company_logo"))

	reasons = []
	try:
		if frappe.db.exists("DocType", "Stock Take Variance Reason"):
			reasons = frappe.get_list(
				"Stock Take Variance Reason",
				filters={"is_active": 1},
				fields=["name", "reason_code", "reason_name", "description"],
				order_by="reason_name",
				limit_page_length=100,
			)
	except Exception:
		reasons = []

	roles = frappe.get_roles(user)

	return {
		"user": {
			"name": user,
			"email": user_doc.email,
			"full_name": user_doc.full_name or user,
			"user_image": _absolute_url(user_doc.user_image),
			"roles": roles,
		},
		"settings": settings,
		"warehouses": warehouses,
		"companies": companies,
		"variance_reasons": reasons,
		"server_time": str(now_datetime()),
		"site": frappe.local.site,
	}


@frappe.whitelist()
def get_app_logo():
	"""Public-ish logo fetch (still requires login by default)."""
	_require_login()
	s = _load_settings_dict()
	return {"app_logo": _absolute_url(s.get("app_logo")), "title": s.get("mobile_app_title")}


@frappe.whitelist()
def get_warehouses(company: str | None = None):
	_require_login()
	filters: dict[str, Any] = {"is_group": 0, "disabled": 0}
	if company:
		filters["company"] = company
	return frappe.get_list(
		"Warehouse",
		filters=filters,
		fields=["name", "warehouse_name", "company", "parent_warehouse"],
		order_by="name",
		limit_page_length=500,
	)


@frappe.whitelist()
def get_variance_reasons():
	_require_login()
	return frappe.get_list(
		"Stock Take Variance Reason",
		filters={"is_active": 1},
		fields=["name", "reason_code", "reason_name", "description"],
		order_by="reason_name",
		limit_page_length=100,
	)


@frappe.whitelist()
def list_sessions(
	warehouse: str | None = None,
	status: str | None = None,
	company: str | None = None,
	limit: int = 50,
	mine_only: int = 0,
):
	_require_login()
	filters: dict[str, Any] = {}
	if warehouse:
		filters["warehouse"] = warehouse
	if status:
		filters["status"] = status
	if company:
		filters["company"] = company
	if cint(mine_only):
		filters["stock_take_by"] = frappe.session.user

	return frappe.get_list(
		"Stock Take Session",
		filters=filters,
		fields=[
			"name",
			"title",
			"company",
			"warehouse",
			"status",
			"posting_date",
			"stock_take_by",
			"total_items",
			"items_counted",
			"items_with_variance",
			"total_variance_qty",
			"total_variance_value",
			"docstatus",
			"modified",
			"started_at",
			"completed_at",
		],
		order_by="modified desc",
		limit_page_length=cint(limit) or 50,
	)


@frappe.whitelist()
def get_session(session_name: str):
	_require_login()
	doc = frappe.get_doc("Stock Take Session", session_name)
	return _session_to_dict(doc)


@frappe.whitelist()
def create_session(
	warehouse: str,
	company: str | None = None,
	title: str | None = None,
	device_info: str | None = None,
):
	_require_login()
	if not warehouse:
		frappe.throw(_("Warehouse is required"))

	if not company:
		company = frappe.db.get_value("Warehouse", warehouse, "company")
	if not company:
		company = frappe.db.get_single_value("Stock Take Settings", "company") or frappe.defaults.get_user_default(
			"Company"
		)

	doc = frappe.get_doc(
		{
			"doctype": "Stock Take Session",
			"warehouse": warehouse,
			"company": company,
			"title": title,
			"stock_take_by": frappe.session.user,
			"posting_date": nowdate(),
			"posting_time": nowtime(),
			"started_at": now_datetime(),
			"status": "In Progress",
			"device_info": device_info,
		}
	)
	doc.insert()
	frappe.db.commit()
	return _session_to_dict(doc)


@frappe.whitelist()
def open_or_create_session(warehouse: str, company: str | None = None, device_info: str | None = None):
	"""Resume latest In Progress session for warehouse+user, or create new."""
	_require_login()
	existing = frappe.get_all(
		"Stock Take Session",
		filters={
			"warehouse": warehouse,
			"stock_take_by": frappe.session.user,
			"status": "In Progress",
			"docstatus": 0,
		},
		fields=["name"],
		order_by="modified desc",
		limit=1,
	)
	if existing:
		return get_session(existing[0].name)
	return create_session(warehouse=warehouse, company=company, device_info=device_info)


@frappe.whitelist()
def scan_barcode(barcode: str, warehouse: str, session_name: str | None = None):
	"""
	Step 3+4: Identify item from barcode and pull Actual Balance (Book Balance).
	Does not yet save physical count.
	"""
	_require_login()
	barcode = (barcode or "").strip()
	if not barcode:
		frappe.throw(_("Barcode is required"))
	if not warehouse:
		frappe.throw(_("Warehouse is required"))

	item = _get_item_by_barcode(barcode)
	if not item:
		frappe.throw(_("No item found for barcode: {0}").format(barcode), title=_("Unknown Barcode"))

	if cint(item.get("disabled")):
		frappe.throw(_("Item {0} is disabled").format(item.get("name")))
	if not cint(item.get("is_stock_item")):
		frappe.throw(_("Item {0} is not a stock item").format(item.get("name")))

	actual_balance, valuation_rate = _get_bin_qty(item["name"], warehouse)

	# Existing line in session?
	existing_line = None
	if session_name and frappe.db.exists("Stock Take Session", session_name):
		existing_line = frappe.db.get_value(
			"Stock Take Item",
			{"parent": session_name, "item_code": item["name"]},
			["name", "physical_qty", "variance", "reason_for_variance", "actual_balance"],
			as_dict=True,
		)

	return {
		"item_code": item["name"],
		"item_name": item.get("item_name"),
		"barcode": item.get("barcode") or barcode,
		"stock_uom": item.get("stock_uom"),
		"uom": item.get("barcode_uom") or item.get("stock_uom"),
		"warehouse": warehouse,
		"actual_balance": actual_balance,
		"valuation_rate": valuation_rate,
		"has_batch_no": cint(item.get("has_batch_no")),
		"has_serial_no": cint(item.get("has_serial_no")),
		"image": _absolute_url(item.get("image")),
		"existing_line": existing_line,
		"variance_formula": "Physical Count - Actual Balance",
	}


@frappe.whitelist()
def search_items(query: str, warehouse: str | None = None, limit: int = 20):
	"""Manual item search when barcode is unavailable."""
	_require_login()
	query = (query or "").strip()
	if len(query) < 1:
		return []

	limit = cint(limit) or 20
	items = frappe.db.sql(
		"""
		SELECT name AS item_code, item_name, stock_uom, image, disabled, is_stock_item
		FROM `tabItem`
		WHERE disabled = 0 AND is_stock_item = 1
		  AND (name LIKE %(q)s OR item_name LIKE %(q)s OR name = %(exact)s)
		ORDER BY
			CASE WHEN name = %(exact)s THEN 0 ELSE 1 END,
			item_name
		LIMIT %(limit)s
		""",
		{"q": f"%{query}%", "exact": query, "limit": limit},
		as_dict=True,
	)

	# Also search barcodes
	barcode_hits = frappe.db.sql(
		"""
		SELECT ib.parent AS item_code, ib.barcode, i.item_name, i.stock_uom, i.image
		FROM `tabItem Barcode` ib
		INNER JOIN `tabItem` i ON i.name = ib.parent
		WHERE ib.barcode LIKE %(q)s AND i.disabled = 0 AND i.is_stock_item = 1
		LIMIT %(limit)s
		""",
		{"q": f"%{query}%", "limit": limit},
		as_dict=True,
	)

	seen = {i["item_code"] for i in items}
	for b in barcode_hits:
		if b["item_code"] not in seen:
			items.append(
				{
					"item_code": b["item_code"],
					"item_name": b["item_name"],
					"stock_uom": b["stock_uom"],
					"image": b.get("image"),
					"barcode": b.get("barcode"),
				}
			)
			seen.add(b["item_code"])

	if warehouse:
		for it in items:
			qty, rate = _get_bin_qty(it["item_code"], warehouse)
			it["actual_balance"] = qty
			it["valuation_rate"] = rate
			it["warehouse"] = warehouse
			it["image"] = _absolute_url(it.get("image"))
	else:
		for it in items:
			it["image"] = _absolute_url(it.get("image"))

	return items[:limit]


@frappe.whitelist()
def capture_count(
	session_name: str,
	item_code: str,
	physical_qty: float,
	barcode: str | None = None,
	reason_for_variance: str | None = None,
	reason_notes: str | None = None,
	batch_no: str | None = None,
	serial_no: str | None = None,
	device_id: str | None = None,
	accumulate: int | None = None,
):
	"""
	Step 5: Capture physical count for an item in a session.
	Variance = Physical Count - Actual Balance (auto).
	Reason mandatory when variance != 0 (per settings).
	"""
	_require_login()
	doc = frappe.get_doc("Stock Take Session", session_name)
	if doc.docstatus != 0:
		frappe.throw(_("Session {0} is not editable").format(session_name))

	warehouse = doc.warehouse
	actual_balance, valuation_rate = _get_bin_qty(item_code, warehouse)

	settings_behavior = frappe.db.get_single_value("Stock Take Settings", "duplicate_scan_behavior") or "Accumulate"
	do_accumulate = cint(accumulate) if accumulate is not None else (1 if settings_behavior == "Accumulate" else 0)

	existing = None
	for row in doc.items:
		if row.item_code == item_code:
			existing = row
			break

	physical_qty = flt(physical_qty)
	if existing and do_accumulate:
		physical_qty = flt(existing.physical_qty) + physical_qty

	variance = physical_qty - flt(actual_balance)

	require_reason = cint(frappe.db.get_single_value("Stock Take Settings", "require_variance_reason"))
	if require_reason and flt(variance) != 0 and not reason_for_variance and not (existing and existing.reason_for_variance):
		frappe.throw(
			_("Reason for Variance is mandatory when variance ({0}) is not zero.").format(variance),
			title=_("Variance Reason Required"),
		)

	allow_neg = cint(frappe.db.get_single_value("Stock Take Settings", "allow_negative_stock_count"))
	if not allow_neg and physical_qty < 0:
		frappe.throw(_("Physical Quantity cannot be negative"))

	item_name = frappe.db.get_value("Item", item_code, "item_name")
	stock_uom = frappe.db.get_value("Item", item_code, "stock_uom")

	payload = {
		"item_code": item_code,
		"item_name": item_name,
		"barcode": barcode,
		"uom": stock_uom,
		"stock_uom": stock_uom,
		"warehouse": warehouse,
		"actual_balance": actual_balance,
		"physical_qty": physical_qty,
		"variance": variance,
		"valuation_rate": valuation_rate,
		"variance_value": variance * flt(valuation_rate),
		"reason_for_variance": reason_for_variance or (existing.reason_for_variance if existing else None),
		"reason_notes": reason_notes or (existing.reason_notes if existing else None),
		"scanned_at": now_datetime(),
		"scanned_by": frappe.session.user,
		"device_id": device_id,
		"batch_no": batch_no,
		"serial_no": serial_no,
		"is_counted": 1,
	}

	if existing:
		for k, v in payload.items():
			existing.set(k, v)
	else:
		doc.append("items", payload)

	if doc.status == "Draft":
		doc.status = "In Progress"

	doc.save()
	frappe.db.commit()

	# Update last stock take on item
	try:
		frappe.db.set_value("Item", item_code, "ako_last_stock_take_date", now_datetime(), update_modified=False)
	except Exception:
		pass

	return _session_to_dict(doc)


@frappe.whitelist()
def update_line(
	session_name: str,
	line_name: str,
	physical_qty: float | None = None,
	reason_for_variance: str | None = None,
	reason_notes: str | None = None,
):
	_require_login()
	doc = frappe.get_doc("Stock Take Session", session_name)
	if doc.docstatus != 0:
		frappe.throw(_("Session is not editable"))

	row = None
	for r in doc.items:
		if r.name == line_name:
			row = r
			break
	if not row:
		frappe.throw(_("Line not found"))

	if physical_qty is not None:
		row.physical_qty = flt(physical_qty)
		# refresh actual balance
		bal, rate = _get_bin_qty(row.item_code, row.warehouse or doc.warehouse)
		row.actual_balance = bal
		row.valuation_rate = rate
		row.variance = flt(row.physical_qty) - flt(row.actual_balance)
		row.variance_value = flt(row.variance) * flt(row.valuation_rate)

	if reason_for_variance is not None:
		row.reason_for_variance = reason_for_variance
	if reason_notes is not None:
		row.reason_notes = reason_notes

	row.scanned_at = now_datetime()
	row.scanned_by = frappe.session.user
	doc.save()
	frappe.db.commit()
	return _session_to_dict(doc)


@frappe.whitelist()
def remove_line(session_name: str, line_name: str):
	_require_login()
	doc = frappe.get_doc("Stock Take Session", session_name)
	if doc.docstatus != 0:
		frappe.throw(_("Session is not editable"))
	doc.items = [r for r in doc.items if r.name != line_name]
	doc.save()
	frappe.db.commit()
	return _session_to_dict(doc)


@frappe.whitelist()
def submit_session(session_name: str):
	"""Step 6: Submit stock take."""
	_require_login()
	doc = frappe.get_doc("Stock Take Session", session_name)
	doc.submit()
	frappe.db.commit()
	return _session_to_dict(doc)


@frappe.whitelist()
def refresh_session_balances(session_name: str):
	_require_login()
	doc = frappe.get_doc("Stock Take Session", session_name)
	if doc.docstatus != 0:
		frappe.throw(_("Session is not editable"))
	for row in doc.items:
		bal, rate = _get_bin_qty(row.item_code, row.warehouse or doc.warehouse)
		row.actual_balance = bal
		row.valuation_rate = rate
		row.variance = flt(row.physical_qty) - flt(row.actual_balance)
		row.variance_value = flt(row.variance) * flt(row.valuation_rate)
	doc.save()
	frappe.db.commit()
	return _session_to_dict(doc)


@frappe.whitelist()
def bulk_sync_counts(session_name: str, items: str | list | None = None):
	"""
	Offline queue sync: items is JSON list of
	{item_code, physical_qty, barcode, reason_for_variance, reason_notes, scanned_at, ...}
	"""
	_require_login()
	if isinstance(items, str):
		items = json.loads(items)
	items = items or []

	doc = frappe.get_doc("Stock Take Session", session_name)
	if doc.docstatus != 0:
		frappe.throw(_("Session is not editable"))

	results = []
	for payload in items:
		try:
			item_code = payload.get("item_code")
			if not item_code and payload.get("barcode"):
				found = _get_item_by_barcode(payload["barcode"])
				if not found:
					results.append({"ok": False, "barcode": payload.get("barcode"), "error": "Unknown barcode"})
					continue
				item_code = found["name"]

			capture_count(
				session_name=session_name,
				item_code=item_code,
				physical_qty=payload.get("physical_qty") or 0,
				barcode=payload.get("barcode"),
				reason_for_variance=payload.get("reason_for_variance"),
				reason_notes=payload.get("reason_notes"),
				batch_no=payload.get("batch_no"),
				serial_no=payload.get("serial_no"),
				device_id=payload.get("device_id"),
				accumulate=payload.get("accumulate", 0),
			)
			results.append({"ok": True, "item_code": item_code})
		except Exception as e:
			results.append({"ok": False, "item_code": payload.get("item_code"), "error": str(e)})

	return {"results": results, "session": get_session(session_name)}


@frappe.whitelist()
def get_session_summary(session_name: str):
	"""Lightweight summary for mobile — avoids heavy full-doc serialization timeouts."""
	_require_login()
	meta = frappe.db.get_value(
		"Stock Take Session",
		session_name,
		[
			"name",
			"title",
			"company",
			"warehouse",
			"status",
			"posting_date",
			"stock_take_by",
			"total_items",
			"items_counted",
			"items_with_variance",
			"total_variance_qty",
			"total_variance_value",
			"docstatus",
			"completed_at",
			"stock_reconciliation",
		],
		as_dict=True,
	)
	if not meta:
		frappe.throw(_("Session {0} not found").format(session_name))

	rows = frappe.get_all(
		"Stock Take Item",
		filters={"parent": session_name},
		fields=[
			"item_code",
			"item_name",
			"actual_balance",
			"physical_qty",
			"variance",
			"variance_value",
			"reason_for_variance",
		],
		order_by="idx asc",
		limit_page_length=5000,
	)

	positive, negative, zero, missing_reason = [], [], [], []
	for row in rows:
		entry = {
			"item_code": row.item_code,
			"item_name": row.item_name,
			"actual_balance": row.actual_balance,
			"physical_qty": row.physical_qty,
			"variance": row.variance,
			"variance_value": row.variance_value,
			"reason_for_variance": row.reason_for_variance,
		}
		v = flt(row.variance)
		if v > 0:
			positive.append(entry)
		elif v < 0:
			negative.append(entry)
		else:
			zero.append(entry)
		if v != 0 and not row.reason_for_variance:
			missing_reason.append(entry)

	# Compact session payload (no full child table dump)
	session = {
		"name": meta.name,
		"title": meta.title,
		"company": meta.company,
		"warehouse": meta.warehouse,
		"status": meta.status,
		"posting_date": str(meta.posting_date) if meta.posting_date else None,
		"stock_take_by": meta.stock_take_by,
		"total_items": meta.total_items,
		"items_counted": meta.items_counted,
		"items_with_variance": meta.items_with_variance,
		"total_variance_qty": meta.total_variance_qty,
		"total_variance_value": meta.total_variance_value,
		"docstatus": meta.docstatus,
		"completed_at": str(meta.completed_at) if meta.completed_at else None,
		"stock_reconciliation": meta.stock_reconciliation,
		"items": [],
	}

	return {
		"session": session,
		"surplus": positive,
		"shortage": negative,
		"matched": zero,
		"exceptions": missing_reason,
		"counts": {
			"surplus": len(positive),
			"shortage": len(negative),
			"matched": len(zero),
			"exceptions": len(missing_reason),
		},
	}


@frappe.whitelist()
def export_session_excel(session_name: str):
	"""Generate Excel export for reporting (Step 8)."""
	_require_login()
	from frappe.utils.xlsxutils import make_xlsx

	doc = frappe.get_doc("Stock Take Session", session_name)
	data = [
		[
			"Item Code",
			"Item Name",
			"Barcode",
			"Warehouse",
			"Actual Balance (System)",
			"Physical Qty (Count)",
			"Variance",
			"Variance Value",
			"Reason for Variance",
			"Reason Notes",
			"UOM",
			"Date & Time",
			"User",
		]
	]
	for row in doc.items:
		data.append(
			[
				row.item_code,
				row.item_name,
				row.barcode,
				row.warehouse or doc.warehouse,
				row.actual_balance,
				row.physical_qty,
				row.variance,
				row.variance_value,
				row.reason_for_variance,
				row.reason_notes,
				row.stock_uom or row.uom,
				str(row.scanned_at) if row.scanned_at else "",
				row.scanned_by,
			]
		)

	# Summary sheet data appended as second table separator
	data.append([])
	data.append(["Summary"])
	data.append(["Session", doc.name])
	data.append(["Warehouse", doc.warehouse])
	data.append(["Company", doc.company])
	data.append(["Status", doc.status])
	data.append(["Total Items", doc.total_items])
	data.append(["Items Counted", doc.items_counted])
	data.append(["Items With Variance", doc.items_with_variance])
	data.append(["Total Variance Qty", doc.total_variance_qty])
	data.append(["Total Variance Value", doc.total_variance_value])
	data.append(["Stock Take By", doc.stock_take_by])
	data.append(["Posting Date", str(doc.posting_date)])

	xlsx_file = make_xlsx(data, "Stock Take")
	frappe.local.response.filename = f"StockTake-{doc.name}.xlsx"
	frappe.local.response.filecontent = xlsx_file.getvalue()
	frappe.local.response.type = "binary"


@frappe.whitelist()
def get_dashboard_stats(company: str | None = None):
	_require_login()
	filters = {}
	if company:
		filters["company"] = company

	open_sessions = frappe.db.count("Stock Take Session", {**filters, "status": "In Progress", "docstatus": 0})
	draft_sessions = frappe.db.count("Stock Take Session", {**filters, "status": "Draft", "docstatus": 0})
	submitted_sessions = frappe.db.count("Stock Take Session", {**filters, "docstatus": 1})

	# Recent variance total
	recent = frappe.get_all(
		"Stock Take Session",
		filters={**filters, "docstatus": 1},
		fields=["name", "total_variance_qty", "total_variance_value", "warehouse", "posting_date"],
		order_by="modified desc",
		limit=5,
	)

	return {
		"open_sessions": open_sessions,
		"draft_sessions": draft_sessions,
		"submitted_sessions": submitted_sessions,
		"recent_submitted": recent,
	}
