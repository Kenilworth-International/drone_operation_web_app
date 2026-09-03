import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

export const maintenanceVoucherApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({

    createMaintenanceVoucher: builder.mutation({
      queryFn: async (body) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/maintenance-vouchers/create', method: 'POST', body },
            {}, {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['MaintenanceVouchers', 'VehicleApp'],
    }),

    getPendingMaintenanceVouchers: builder.query({
      queryFn: async () => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/maintenance-vouchers/pending', method: 'GET' },
            {}, {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data || [] };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['MaintenanceVouchers'],
    }),

    getMaintenanceVoucherHistory: builder.query({
      queryFn: async (params = {}) => {
        try {
          const search = new URLSearchParams();
          if (params.status) search.set('status', params.status);
          if (params.settled !== undefined && params.settled !== null && params.settled !== '')
            search.set('settled', String(params.settled));
          const qs = search.toString();
          const result = await nodeBackendBaseQuery(
            { url: `/api/maintenance-vouchers/history${qs ? `?${qs}` : ''}`, method: 'GET' },
            {}, {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data || [] };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['MaintenanceVouchers'],
    }),

    getMaintenanceVoucherById: builder.query({
      queryFn: async (id) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/maintenance-vouchers/${id}`, method: 'GET' },
            {}, {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: (_r, _e, id) => [{ type: 'MaintenanceVouchers', id }],
    }),

    approveMaintenanceVoucher: builder.mutation({
      queryFn: async (id) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/maintenance-vouchers/${id}/approve`, method: 'POST', body: {} },
            {}, {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['MaintenanceVouchers', 'VehicleApp'],
    }),

    declineMaintenanceVoucher: builder.mutation({
      queryFn: async ({ id, reason }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/maintenance-vouchers/${id}/decline`, method: 'POST', body: { reason } },
            {}, {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['MaintenanceVouchers', 'VehicleApp'],
    }),

    recordMaintenanceVoucherPhysicalApproval: builder.mutation({
      queryFn: async ({ id, ...body }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/maintenance-vouchers/${id}/physical-approval`, method: 'POST', body },
            {}, {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['MaintenanceVouchers', 'VehicleApp'],
    }),

    settleMaintenanceVoucher: builder.mutation({
      queryFn: async ({ id, ...body }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/maintenance-vouchers/${id}/settle`, method: 'POST', body },
            {}, {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['MaintenanceVouchers', 'VehicleApp'],
    }),

  }),
});

export const {
  useCreateMaintenanceVoucherMutation,
  useGetPendingMaintenanceVouchersQuery,
  useGetMaintenanceVoucherHistoryQuery,
  useGetMaintenanceVoucherByIdQuery,
  useApproveMaintenanceVoucherMutation,
  useDeclineMaintenanceVoucherMutation,
  useRecordMaintenanceVoucherPhysicalApprovalMutation,
  useSettleMaintenanceVoucherMutation,
} = maintenanceVoucherApi;
