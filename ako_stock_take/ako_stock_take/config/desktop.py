from frappe import _


def get_data():
	return [
		{
			"module_name": "AKO Stock Take",
			"type": "module",
			"label": _("AKO Stock Take"),
			"icon": "octicon octicon-package",
			"color": "blue",
			"description": "Barcode-driven stock take with mobile app",
		}
	]
