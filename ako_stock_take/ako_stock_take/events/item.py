import frappe


def validate_item_barcode(doc, method=None):
	"""Ensure barcodes on Item are unique across the system (ERPNext already enforces mostly)."""
	seen = set()
	for row in doc.get("barcodes") or []:
		code = (row.barcode or "").strip()
		if not code:
			continue
		if code in seen:
			frappe.throw(f"Duplicate barcode {code} on item {doc.name}")
		seen.add(code)
