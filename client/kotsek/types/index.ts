export interface SystemLog {
  id: string;
  timestamp: string;
  log_type: string;
  action: string;
  details: any;
  user_id: string;
  ip_address: string;
} 