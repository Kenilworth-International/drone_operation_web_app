import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

export const hrLeaveApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getHrLeaveTypes: builder.query({
      queryFn: async () =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/types', method: 'POST', body: {} }, {}, {}),
      providesTags: ['HrLeave'],
    }),
    getHrLeaveTypesAll: builder.query({
      queryFn: async () =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/types', method: 'POST', body: { includeAll: 1 } }, {}, {}),
      providesTags: ['HrLeave'],
    }),
    getHrDashboard: builder.query({
      queryFn: async (body = {}) =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/dashboard', method: 'POST', body }, {}, {}),
      providesTags: ['HrLeave', 'HrAttendance'],
    }),
    getHrmDashboardSummary: builder.query({
      queryFn: async (body = {}) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/hr/dashboard/summary', method: 'POST', body: body || {} },
          {},
          {},
        );
        if (result.error) return result;
        return { data: result.data?.data || null };
      },
      providesTags: ['HrmDashboard'],
    }),
    getHrMyLeaveRequests: builder.query({
      queryFn: async (body = {}) =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/my-requests', method: 'POST', body }, {}, {}),
      providesTags: ['HrLeave'],
    }),
    createHrLeaveRequest: builder.mutation({
      queryFn: async (body) =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/request', method: 'POST', body }, {}, {}),
      invalidatesTags: ['HrLeave'],
    }),
    getHrApprovalsInbox: builder.query({
      queryFn: async (body = {}) =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/approvals/inbox', method: 'POST', body }, {}, {}),
      providesTags: ['HrLeave'],
    }),
    decideHrLeaveRequest: builder.mutation({
      queryFn: async (body) =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/approvals/decide', method: 'POST', body }, {}, {}),
      invalidatesTags: ['HrLeave'],
    }),
    markHrAttendance: builder.mutation({
      queryFn: async (body) =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/attendance/mark', method: 'POST', body }, {}, {}),
      invalidatesTags: ['HrAttendance'],
    }),
    getHrAttendanceLog: builder.query({
      queryFn: async (body = {}) =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/attendance/log', method: 'POST', body }, {}, {}),
      providesTags: ['HrAttendance'],
    }),
    saveHrRosterPlan: builder.mutation({
      queryFn: async (body) =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/roster/save', method: 'POST', body }, {}, {}),
      invalidatesTags: ['HrRoster'],
    }),
    getHrRosterPlan: builder.query({
      queryFn: async (body = {}) =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/roster/view', method: 'POST', body }, {}, {}),
      providesTags: ['HrRoster'],
    }),
    getHrHolidayCalendar: builder.query({
      queryFn: async (body = {}) =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/holidays/list', method: 'POST', body }, {}, {}),
      providesTags: ['HrHoliday'],
    }),
    saveHrHolidayMark: builder.mutation({
      queryFn: async (body) =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/holidays/save', method: 'POST', body }, {}, {}),
      invalidatesTags: ['HrHoliday', 'HrRoster', 'HrAttendance'],
    }),
    getHrAttendanceDayView: builder.query({
      queryFn: async (body = {}) =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/attendance/day-view', method: 'POST', body }, {}, {}),
      providesTags: ['HrAttendance'],
    }),
    acceptHrLieuLeave: builder.mutation({
      queryFn: async (body) =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/attendance/lieu-leave/accept', method: 'POST', body }, {}, {}),
      invalidatesTags: ['HrAttendance', 'HrLeave'],
    }),
    listHrLeaveAdminTypes: builder.query({
      queryFn: async (body = {}) =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/admin/types/list', method: 'POST', body }, {}, {}),
      providesTags: ['HrLeaveAdmin', 'HrLeave'],
    }),
    saveHrLeaveAdminType: builder.mutation({
      queryFn: async (body) =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/admin/types/save', method: 'POST', body }, {}, {}),
      invalidatesTags: ['HrLeaveAdmin', 'HrLeave'],
    }),
    setHrLeaveAdminTypeStatus: builder.mutation({
      queryFn: async (body) =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/admin/types/status', method: 'POST', body }, {}, {}),
      invalidatesTags: ['HrLeaveAdmin', 'HrLeave'],
    }),
    listHrLeaveAdminPolicies: builder.query({
      queryFn: async (body = {}) =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/admin/policies/list', method: 'POST', body }, {}, {}),
      providesTags: ['HrLeaveAdmin'],
    }),
    saveHrLeaveAdminPolicy: builder.mutation({
      queryFn: async (body) =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/admin/policies/save', method: 'POST', body }, {}, {}),
      invalidatesTags: ['HrLeaveAdmin', 'HrLeave'],
    }),
    listHrLeaveAdminEntitlements: builder.query({
      queryFn: async (body = {}) =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/admin/entitlements/list', method: 'POST', body }, {}, {}),
      providesTags: ['HrLeaveAdmin'],
    }),
    saveHrLeaveAdminEntitlement: builder.mutation({
      queryFn: async (body) =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/admin/entitlements/save', method: 'POST', body }, {}, {}),
      invalidatesTags: ['HrLeaveAdmin', 'HrLeave'],
    }),
    deleteHrLeaveAdminEntitlement: builder.mutation({
      queryFn: async (body) =>
        nodeBackendBaseQuery({ url: '/api/hr-leave/admin/entitlements/delete', method: 'POST', body }, {}, {}),
      invalidatesTags: ['HrLeaveAdmin', 'HrLeave'],
    }),
  }),
});

export const {
  useGetHrLeaveTypesQuery,
  useGetHrLeaveTypesAllQuery,
  useGetHrDashboardQuery,
  useGetHrmDashboardSummaryQuery,
  useGetHrMyLeaveRequestsQuery,
  useCreateHrLeaveRequestMutation,
  useGetHrApprovalsInboxQuery,
  useDecideHrLeaveRequestMutation,
  useMarkHrAttendanceMutation,
  useGetHrAttendanceLogQuery,
  useSaveHrRosterPlanMutation,
  useGetHrRosterPlanQuery,
  useGetHrHolidayCalendarQuery,
  useSaveHrHolidayMarkMutation,
  useGetHrAttendanceDayViewQuery,
  useAcceptHrLieuLeaveMutation,
  useListHrLeaveAdminTypesQuery,
  useSaveHrLeaveAdminTypeMutation,
  useSetHrLeaveAdminTypeStatusMutation,
  useListHrLeaveAdminPoliciesQuery,
  useSaveHrLeaveAdminPolicyMutation,
  useListHrLeaveAdminEntitlementsQuery,
  useSaveHrLeaveAdminEntitlementMutation,
  useDeleteHrLeaveAdminEntitlementMutation,
} = hrLeaveApi;
