from setuptools import setup, find_packages

setup(
	name="ako_stock_take",
	version="1.0.0",
	description="Barcode stock take for ERPNext with mobile counting",
	author="Justin Msengi",
	author_email="justinemsengi@gmail.com",
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
	install_requires=[],
)
