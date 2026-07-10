app_name = "ako_stock_take"
app_title = "AKO Stock Take"
app_publisher = "Justin Msengi / Koda Technologies"
app_description = "Enterprise Stock Take with barcode mobile app integration"
app_email = "justinemsengi@gmail.com"
app_license = "mit"
app_version = "1.0.0"

# Includes in <head>
# ------------------

app_include_css = "/assets/ako_stock_take/css/ako_stock_take.css"
app_include_js = "/assets/ako_stock_take/js/ako_stock_take.js"

# Home Pages
# ----------
# application_home_page = "login"

# Website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------
# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------
# add methods and filters to jinja environment
# jinja = {
# 	"methods": "ako_stock_take.utils.jinja_methods",
# 	"filters": "ako_stock_take.utils.jinja_filters"
# }

# Installation
# ------------
after_install = "ako_stock_take.install.after_install"
after_migrate = "ako_stock_take.install.after_migrate"

# Uninstallation
# ------------
# before_uninstall = "ako_stock_take.uninstall.before_uninstall"
# after_uninstall = "ako_stock_take.uninstall.after_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "ako_stock_take.notifications.get_notification_config"

# Permissions
# -----------
# permission_query_conditions = {
# 	"Stock Take Session": "ako_stock_take.permissions.get_permission_query_conditions",
# }

# Document Events
# ---------------
doc_events = {
	"Item": {
		"validate": "ako_stock_take.events.item.validate_item_barcode",
	},
}

# Scheduled Tasks
# ---------------
# scheduler_events = {
# 	"daily": [
# 		"ako_stock_take.tasks.daily"
# 	],
# }

# Testing
# -------
# before_tests = "ako_stock_take.install.before_tests"

# Overriding Methods
# ------------------------------
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "ako_stock_take.event.get_events"
# }

# Fixtures
# --------
fixtures = [
	{
		"dt": "Role",
		"filters": [["name", "in", ["Stock Take User", "Stock Take Manager"]]],
	},
	{
		"dt": "Custom Field",
		"filters": [["module", "=", "AKO Stock Take"]],
	},
	{
		"dt": "Stock Take Variance Reason",
	},
	{
		"dt": "Workspace",
		"filters": [["module", "=", "AKO Stock Take"]],
	},
]

# User Data Protection
# --------------------
user_data_fields = [
	{
		"doctype": "Stock Take Session",
		"filter_by": "owner",
		"redact_fields": [],
		"partial": 1,
	},
]

# Authentication and authorization
# --------------------------------
# auth_hooks = [
# 	"ako_stock_take.auth.validate"
# ]

# Translation
# --------------------------------
# export_python_translations = True

default_log_clearing_doctypes = {
	# "Stock Take Session": 90,  # days
}
