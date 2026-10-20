import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

async function payrollQuery(url, method = 'GET', body) {
  const result = await nodeBackendBaseQuery(
    {
      url,
      method,
      ...(body !== undefined ? { body } : {}),
    },
    {},
    {}
  );
  if (result.error) return { error: result.error };
  return { data: result.data?.data !== undefined ? result.data.data : result.data };
}

export const payrollApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPayrollComponents: builder.query({
      queryFn: async (includeInactive = false) =>
        payrollQuery(`/api/payroll/components?includeInactive=${includeInactive ? '1' : '0'}`),
      providesTags: ['PayrollComponents'],
    }),
    createPayrollComponent: builder.mutation({
      queryFn: async (body) => payrollQuery('/api/payroll/components', 'POST', body),
      invalidatesTags: ['PayrollComponents'],
    }),
    updatePayrollComponent: builder.mutation({
      queryFn: async ({ id, ...body }) => payrollQuery(`/api/payroll/components/${id}`, 'PUT', body),
      invalidatesTags: ['PayrollComponents', 'PayrollAssignments'],
    }),

    getPayrollSchemes: builder.query({
      queryFn: async () => payrollQuery('/api/payroll/performance-schemes?includeInactive=1'),
      providesTags: ['PayrollSchemes'],
    }),
    savePayrollScheme: builder.mutation({
      queryFn: async ({ id, ...body }) =>
        id
          ? payrollQuery(`/api/payroll/performance-schemes/${id}`, 'PUT', body)
          : payrollQuery('/api/payroll/performance-schemes', 'POST', body),
      invalidatesTags: ['PayrollSchemes'],
    }),

    getPayrollAssignmentMatrix: builder.query({
      queryFn: async () => payrollQuery('/api/payroll/assignments/matrix'),
      providesTags: ['PayrollAssignments'],
    }),
    getEmployeePayrollAssignments: builder.query({
      queryFn: async (employeeId) => payrollQuery(`/api/payroll/assignments/${employeeId}`),
      providesTags: (_r, _e, id) => [{ type: 'PayrollAssignments', id }],
    }),
    setEmployeePayrollAssignments: builder.mutation({
      queryFn: async ({ employeeId, assignments }) =>
        payrollQuery(`/api/payroll/assignments/${employeeId}`, 'PUT', { assignments }),
      invalidatesTags: ['PayrollAssignments'],
    }),
    migratePayrollAssignments: builder.mutation({
      queryFn: async (body = {}) =>
        payrollQuery('/api/payroll/assignments/migrate-from-profile', 'POST', body),
      invalidatesTags: ['PayrollAssignments'],
    }),

    getPayrollStatutoryRates: builder.query({
      queryFn: async () => payrollQuery('/api/payroll/statutory-rates'),
      providesTags: ['PayrollStatutory'],
    }),
    createPayrollStatutoryRate: builder.mutation({
      queryFn: async (body) => payrollQuery('/api/payroll/statutory-rates', 'POST', body),
      invalidatesTags: ['PayrollStatutory'],
    }),
    updatePayrollStatutoryRate: builder.mutation({
      queryFn: async ({ id, ...body }) =>
        payrollQuery(`/api/payroll/statutory-rates/${id}`, 'PUT', body),
      invalidatesTags: ['PayrollStatutory'],
    }),

    getPayrollMailSettings: builder.query({
      queryFn: async () => payrollQuery('/api/payroll/mail-settings'),
      providesTags: ['PayrollMail'],
    }),
    savePayrollMailSettings: builder.mutation({
      queryFn: async (body) => payrollQuery('/api/payroll/mail-settings', 'PUT', body),
      invalidatesTags: ['PayrollMail'],
    }),

    getPayrollPeriods: builder.query({
      queryFn: async () => payrollQuery('/api/payroll/periods'),
      providesTags: ['PayrollPeriods'],
    }),
    createPayrollPeriod: builder.mutation({
      queryFn: async (body) => payrollQuery('/api/payroll/periods', 'POST', body),
      invalidatesTags: ['PayrollPeriods'],
    }),
    calculatePayrollPeriod: builder.mutation({
      queryFn: async ({ id, employeeIds }) =>
        payrollQuery(`/api/payroll/periods/${id}/calculate`, 'POST', { employeeIds }),
      invalidatesTags: ['PayrollPeriods', 'PayrollPayslips'],
    }),
    lockPayrollPeriod: builder.mutation({
      queryFn: async (id) => payrollQuery(`/api/payroll/periods/${id}/lock`, 'POST', {}),
      invalidatesTags: ['PayrollPeriods', 'PayrollPayslips'],
    }),
    markPayrollPeriodPaid: builder.mutation({
      queryFn: async ({ id, ...body }) =>
        payrollQuery(`/api/payroll/periods/${id}/mark-paid`, 'POST', body),
      invalidatesTags: ['PayrollPeriods', 'PayrollPayslips'],
    }),
    getPayrollPayslips: builder.query({
      queryFn: async (periodId) => payrollQuery(`/api/payroll/periods/${periodId}/payslips`),
      providesTags: ['PayrollPayslips'],
    }),
    getPayrollPayslip: builder.query({
      queryFn: async (id) => payrollQuery(`/api/payroll/payslips/${id}`),
      providesTags: (_r, _e, id) => [{ type: 'PayrollPayslips', id }],
    }),
    emailPayrollPayslip: builder.mutation({
      queryFn: async ({ id, toEmail }) =>
        payrollQuery(`/api/payroll/payslips/${id}/email`, 'POST', { toEmail }),
      invalidatesTags: ['PayrollPayslips'],
    }),
    bulkEmailPayrollPeriod: builder.mutation({
      queryFn: async (id) => payrollQuery(`/api/payroll/periods/${id}/email`, 'POST', {}),
      invalidatesTags: ['PayrollPayslips'],
    }),
  }),
});

export const {
  useGetPayrollComponentsQuery,
  useCreatePayrollComponentMutation,
  useUpdatePayrollComponentMutation,
  useGetPayrollSchemesQuery,
  useSavePayrollSchemeMutation,
  useGetPayrollAssignmentMatrixQuery,
  useGetEmployeePayrollAssignmentsQuery,
  useSetEmployeePayrollAssignmentsMutation,
  useMigratePayrollAssignmentsMutation,
  useGetPayrollStatutoryRatesQuery,
  useCreatePayrollStatutoryRateMutation,
  useUpdatePayrollStatutoryRateMutation,
  useGetPayrollMailSettingsQuery,
  useSavePayrollMailSettingsMutation,
  useGetPayrollPeriodsQuery,
  useCreatePayrollPeriodMutation,
  useCalculatePayrollPeriodMutation,
  useLockPayrollPeriodMutation,
  useMarkPayrollPeriodPaidMutation,
  useGetPayrollPayslipsQuery,
  useGetPayrollPayslipQuery,
  useEmailPayrollPayslipMutation,
  useBulkEmailPayrollPeriodMutation,
} = payrollApi;
