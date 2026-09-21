export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'TERMINATED';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY';
export type LeaveType = 'ANNUAL' | 'SICK' | 'CASUAL' | 'UNPAID' | 'OTHER';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type PayrollStatus = 'DRAFT' | 'APPROVED' | 'PAID';

export interface Department {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  _id: string;
  employeeId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  department: Department | string;
  designation: string;
  joiningDate: string;
  status: EmployeeStatus;
  currentSalary: number;
  cvPath?: string;
  nidPath?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryLineItem {
  label: string;
  amount: number;
}

export interface SalaryStructure {
  _id: string;
  employee: { _id: string; name: string; employeeId: string } | string;
  baseSalary: number;
  allowances: SalaryLineItem[];
  deductions: SalaryLineItem[];
  effectiveDate: string;
  isActive: boolean;
  createdAt: string;
}

export interface Attendance {
  _id: string;
  employee: { _id: string; name: string; employeeId: string } | string;
  date: string;
  status: AttendanceStatus;
  notes?: string;
  createdAt: string;
}

export interface Leave {
  _id: string;
  employee: { _id: string; name: string; employeeId: string } | string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  notes?: string;
  createdAt: string;
}

export interface Payroll {
  _id: string;
  payrollNumber: string;
  employee: { _id: string; name: string; employeeId: string; department?: string } | string;
  period: { month: number; year: number };
  baseSalary: number;
  allowances: SalaryLineItem[];
  deductions: SalaryLineItem[];
  totalAllowances: number;
  totalDeductions: number;
  grossSalary: number;
  netSalary: number;
  presentDays: number;
  absentDays: number;
  status: PayrollStatus;
  paidAt?: string;
  notes?: string;
  createdAt: string;
}

// API response shapes
export interface DepartmentsResponse { success: boolean; data: { departments: Department[] } }
export interface DepartmentResponse { success: boolean; data: { department: Department } }
export interface EmployeesResponse {
  success: boolean;
  data: { employees: Employee[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}
export interface EmployeeResponse { success: boolean; data: { employee: Employee } }
export interface SalaryStructuresResponse { success: boolean; data: { salaryStructures: SalaryStructure[] } }
export interface SalaryStructureResponse { success: boolean; data: { salaryStructure: SalaryStructure } }
export interface AttendanceListResponse {
  success: boolean;
  data: { attendance: Attendance[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}
export interface AttendanceResponse { success: boolean; data: { attendance: Attendance } }
export interface LeavesResponse {
  success: boolean;
  data: { leaves: Leave[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}
export interface LeaveResponse { success: boolean; data: { leave: Leave } }
export interface PayrollsResponse {
  success: boolean;
  data: { payrolls: Payroll[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}
export interface PayrollResponse { success: boolean; data: { payroll: Payroll } }
export interface BulkPayrollResponse { success: boolean; data: { results: { employeeId: string; status: string; reason?: string }[] } }
