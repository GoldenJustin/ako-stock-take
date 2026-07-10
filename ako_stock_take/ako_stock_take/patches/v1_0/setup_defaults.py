import frappe
from ako_stock_take.install import after_migrate


def execute():
	after_migrate()
