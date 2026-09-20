export interface UserRecord {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'staff';
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

export interface UOMConversion {
  _id: string;
  fromUOM: { _id: string; name: string; symbol: string };
  toUOM: { _id: string; name: string; symbol: string };
  factor: number;
  isActive: boolean;
  createdAt: string;
}

export interface UOMConversionsResponse {
  success: boolean;
  data: { conversions: UOMConversion[] };
}
