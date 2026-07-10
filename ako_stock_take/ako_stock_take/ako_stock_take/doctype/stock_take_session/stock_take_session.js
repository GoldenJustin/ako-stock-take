// Copyright (c) 2026, Justin Msengi / Koda Technologies and contributors
// For license information, please see license.txt

frappe.ui.form.on("Stock Take Session", {
	refresh(frm) {
		frm.set_query("warehouse", () => ({
			filters: {
				is_group: 0,
				company: frm.doc.company,
			},
		}));

		if (frm.doc.docstatus === 0) {
			frm.add_custom_button(__("Fetch Balances"), () => {
				frappe.call({
					method: "ako_stock_take.api.stock_take.refresh_session_balances",
					args: { session_name: frm.doc.name },
					freeze: true,
					callback(r) {
						if (!r.exc) {
							frm.reload_doc();
							frappe.show_alert({ message: __("Balances refreshed"), indicator: "green" });
						}
					},
				});
			});
		}

		if (frm.doc.docstatus === 1) {
			frm.add_custom_button(
				__("Export Excel"),
				() => {
					window.open(
						`/api/method/ako_stock_take.api.stock_take.export_session_excel?session_name=${encodeURIComponent(
							frm.doc.name
						)}`
					);
				},
				__("Reports")
			);
		}
	},

	company(frm) {
		if (frm.doc.warehouse) {
			frm.set_value("warehouse", null);
		}
	},
});

frappe.ui.form.on("Stock Take Item", {
	physical_qty(frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		const variance = flt(row.physical_qty) - flt(row.actual_balance);
		frappe.model.set_value(cdt, cdn, "variance", variance);
		frappe.model.set_value(cdt, cdn, "variance_value", variance * flt(row.valuation_rate));
		frm.trigger("calculate_totals_client");
	},

	actual_balance(frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		const variance = flt(row.physical_qty) - flt(row.actual_balance);
		frappe.model.set_value(cdt, cdn, "variance", variance);
		frappe.model.set_value(cdt, cdn, "variance_value", variance * flt(row.valuation_rate));
	},
});

frappe.ui.form.on("Stock Take Session", {
	calculate_totals_client(frm) {
		let total_variance_qty = 0;
		let total_variance_value = 0;
		let items_with_variance = 0;
		(frm.doc.items || []).forEach((row) => {
			total_variance_qty += flt(row.variance);
			total_variance_value += flt(row.variance_value);
			if (flt(row.variance) !== 0) items_with_variance += 1;
		});
		frm.set_value("total_items", (frm.doc.items || []).length);
		frm.set_value("items_counted", (frm.doc.items || []).length);
		frm.set_value("total_variance_qty", total_variance_qty);
		frm.set_value("total_variance_value", total_variance_value);
		frm.set_value("items_with_variance", items_with_variance);
	},
});
