import { api } from '@/lib/store/api';
import type {
  DepartmentsResponse, DepartmentResponse,
  EmployeesResponse, EmployeeResponse,
  SalaryStructuresResponse, SalaryStructureResponse,
  AttendanceListResponse, AttendanceResponse,
  LeavesResponse, LeaveResponse,
  PayrollsResponse, PayrollResponse, BulkPayrollResponse,
} from '../types';

export const hrApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Departments
    getDepartments: build.query<DepartmentsResponse, void>({
      query: () => '/hr/departments',
      providesTags: ['Department'],
    }),
    createDepartment: build.mutation<DepartmentResponse, { name: string; description?: string }>({
      query: (body) => ({ url: '/hr/departments', method: 'POST', body }),
      invalidatesTags: ['Department'],
    }),
    updateDepartment: build.mutation<DepartmentResponse, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/hr/departments/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Department'],
    }),
    deleteDepartment: build.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({ url: `/hr/departments/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Department'],
    }),

    // Employees
    getEmployees: build.query<EmployeesResponse, { page?: number; department?: string; status?: string; search?: string }>({
      query: (params) => ({ url: '/hr/employees', params }),
      providesTags: ['Employee'],
    }),
    getEmployee: build.query<EmployeeResponse, string>({
      query: (id) => `/hr/employees/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Employee', id }],
    }),
    createEmployee: build.mutation<EmployeeResponse, {
      name: string; email?: string; phone?: string; address?: string;
      department: string; designation: string; joiningDate: string;
      status?: string; currentSalary?: number;
    }>({
      query: (body) => ({ url: '/hr/employees', method: 'POST', body }),
      invalidatesTags: ['Employee'],
    }),
    updateEmployee: build.mutation<EmployeeResponse, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/hr/employees/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => ['Employee', { type: 'Employee', id }],
    }),
    deleteEmployee: build.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({ url: `/hr/employees/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Employee'],
    }),

    // Salary Structures
    getSalaryStructures: build.query<SalaryStructuresResponse, string>({
      query: (employeeId) => `/hr/employees/${employeeId}/salary-structures`,
      providesTags: ['Employee'],
    }),
    createSalaryStructure: build.mutation<SalaryStructureResponse, {
      employee: string; baseSalary: number;
      allowances: { label: string; amount: number }[];
      deductions: { label: string; amount: number }[];
      effectiveDate: string;
    }>({
      query: (body) => ({ url: '/hr/salary-structures', method: 'POST', body }),
      invalidatesTags: ['Employee'],
    }),
    updateSalaryStructure: build.mutation<SalaryStructureResponse, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/hr/salary-structures/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Employee'],
    }),

    // Attendance
    getAttendance: build.query<AttendanceListResponse, { page?: number; employee?: string; from?: string; to?: string; status?: string }>({
      query: (params) => ({ url: '/hr/attendance', params }),
      providesTags: ['Attendance'],
    }),
    upsertAttendance: build.mutation<AttendanceResponse, { employee: string; date: string; status: string; notes?: string }>({
      query: (body) => ({ url: '/hr/attendance', method: 'POST', body }),
      invalidatesTags: ['Attendance'],
    }),
    bulkUpsertAttendance: build.mutation<{ success: boolean }, { date: string; records: { employee: string; status: string; notes?: string }[] }>({
      query: (body) => ({ url: '/hr/attendance/bulk', method: 'POST', body }),
      invalidatesTags: ['Attendance'],
    }),
    updateAttendance: build.mutation<AttendanceResponse, { id: string; status: string; notes?: string }>({
      query: ({ id, ...body }) => ({ url: `/hr/attendance/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Attendance'],
    }),

    // Leave
    getLeaves: build.query<LeavesResponse, { page?: number; employee?: string; status?: string; leaveType?: string }>({
      query: (params) => ({ url: '/hr/leaves', params }),
      providesTags: ['Leave'],
    }),
    getLeave: build.query<LeaveResponse, string>({
      query: (id) => `/hr/leaves/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Leave', id }],
    }),
    createLeave: build.mutation<LeaveResponse, {
      employee: string; leaveType: string; startDate: string;
      endDate: string; reason: string; notes?: string;
    }>({
      query: (body) => ({ url: '/hr/leaves', method: 'POST', body }),
      invalidatesTags: ['Leave'],
    }),
    updateLeaveStatus: build.mutation<LeaveResponse, { id: string; status: string; notes?: string }>({
      query: ({ id, ...body }) => ({ url: `/hr/leaves/${id}/status`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => ['Leave', { type: 'Leave', id }],
    }),

    // Payroll
    getPayrolls: build.query<PayrollsResponse, { page?: number; employee?: string; status?: string; month?: number; year?: number }>({
      query: (params) => ({ url: '/hr/payroll', params }),
      providesTags: ['Payroll'],
    }),
    getPayroll: build.query<PayrollResponse, string>({
      query: (id) => `/hr/payroll/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Payroll', id }],
    }),
    generatePayroll: build.mutation<PayrollResponse, { employee: string; month: number; year: number; notes?: string }>({
      query: (body) => ({ url: '/hr/payroll/generate', method: 'POST', body }),
      invalidatesTags: ['Payroll'],
    }),
    bulkGeneratePayroll: build.mutation<BulkPayrollResponse, { month: number; year: number }>({
      query: (body) => ({ url: '/hr/payroll/bulk-generate', method: 'POST', body }),
      invalidatesTags: ['Payroll'],
    }),
    updatePayrollStatus: build.mutation<PayrollResponse, { id: string; status: string }>({
      query: ({ id, status }) => ({ url: `/hr/payroll/${id}/status`, method: 'PATCH', body: { status } }),
      invalidatesTags: (_r, _e, { id }) => ['Payroll', { type: 'Payroll', id }],
    }),
  }),
});

export const {
  useGetDepartmentsQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  useGetEmployeesQuery,
  useGetEmployeeQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
  useGetSalaryStructuresQuery,
  useCreateSalaryStructureMutation,
  useUpdateSalaryStructureMutation,
  useGetAttendanceQuery,
  useUpsertAttendanceMutation,
  useBulkUpsertAttendanceMutation,
  useUpdateAttendanceMutation,
  useGetLeavesQuery,
  useGetLeaveQuery,
  useCreateLeaveMutation,
  useUpdateLeaveStatusMutation,
  useGetPayrollsQuery,
  useGetPayrollQuery,
  useGeneratePayrollMutation,
  useBulkGeneratePayrollMutation,
  useUpdatePayrollStatusMutation,
} = hrApi;
