export type StockTakeStatus = 'Draft' | 'In Progress' | 'Submitted' | 'Cancelled' | 'Closed';

export interface ErpUser {
  name: string;
  email: string;
  full_name: string;
  user_image?: string | null;
  roles: string[];
}

export interface AppSettings {
  company?: string | null;
  app_logo?: string | null;
  require_variance_reason: number;
  allow_negative_stock_count: number;
  auto_fetch_balance: number;
  enable_offline_sync: number;
  default_scan_mode: string;
  allow_manual_item_search: number;
  duplicate_scan_behavior: 'Accumulate' | 'Replace' | 'Prompt' | string;
  lock_actual_balance: number;
  show_system_balance_on_device: number;
  create_stock_reconciliation: number;
  mobile_app_title: string;
  support_email?: string | null;
  support_phone?: string | null;
}

export interface Warehouse {
  name: string;
  warehouse_name?: string;
  company?: string;
  parent_warehouse?: string;
}

export interface Company {
  name: string;
  company_name?: string;
  abbr?: string;
  default_currency?: string;
  company_logo?: string | null;
}

export interface VarianceReason {
  name: string;
  reason_code?: string;
  reason_name: string;
  description?: string;
}

export interface StockTakeItemLine {
  name?: string;
  idx?: number;
  item_code: string;
  item_name?: string;
  barcode?: string;
  uom?: string;
  stock_uom?: string;
  warehouse?: string;
  actual_balance: number;
  physical_qty: number;
  variance: number;
  variance_value?: number;
  valuation_rate?: number;
  reason_for_variance?: string | null;
  reason_notes?: string | null;
  scanned_at?: string | null;
  scanned_by?: string | null;
  batch_no?: string | null;
  serial_no?: string | null;
  is_counted?: number;
}

export interface StockTakeSession {
  name: string;
  title?: string;
  company: string;
  warehouse: string;
  status: StockTakeStatus | string;
  posting_date?: string;
  posting_time?: string;
  stock_take_by?: string;
  started_at?: string;
  completed_at?: string;
  total_items: number;
  items_counted: number;
  items_with_variance: number;
  total_variance_qty: number;
  total_variance_value: number;
  remarks?: string;
  docstatus: number;
  stock_reconciliation?: string | null;
  items: StockTakeItemLine[];
}

export interface SessionListItem {
  name: string;
  title?: string;
  company?: string;
  warehouse: string;
  status: string;
  posting_date?: string;
  stock_take_by?: string;
  total_items?: number;
  items_counted?: number;
  items_with_variance?: number;
  total_variance_qty?: number;
  total_variance_value?: number;
  docstatus: number;
  modified?: string;
  started_at?: string;
  completed_at?: string;
}

export interface ScanResult {
  item_code: string;
  item_name?: string;
  barcode?: string;
  stock_uom?: string;
  uom?: string;
  warehouse: string;
  actual_balance: number;
  valuation_rate: number;
  has_batch_no?: number;
  has_serial_no?: number;
  image?: string | null;
  existing_line?: {
    name: string;
    physical_qty: number;
    variance: number;
    reason_for_variance?: string;
    actual_balance: number;
  } | null;
  variance_formula?: string;
}

export interface BootstrapData {
  user: ErpUser;
  settings: AppSettings;
  warehouses: Warehouse[];
  companies: Company[];
  variance_reasons: VarianceReason[];
  server_time?: string;
  site?: string;
}

export interface DashboardStats {
  open_sessions: number;
  draft_sessions: number;
  submitted_sessions: number;
  recent_submitted: Array<{
    name: string;
    total_variance_qty?: number;
    total_variance_value?: number;
    warehouse?: string;
    posting_date?: string;
  }>;
}

export interface OfflineCountPayload {
  id: string;
  session_name: string;
  item_code: string;
  physical_qty: number;
  barcode?: string;
  reason_for_variance?: string;
  reason_notes?: string;
  batch_no?: string;
  serial_no?: string;
  scanned_at: string;
  accumulate?: number;
}

export interface ConnectionConfig {
  baseUrl: string;
  authMode: 'password' | 'token';
  apiKey?: string;
  apiSecret?: string;
}
