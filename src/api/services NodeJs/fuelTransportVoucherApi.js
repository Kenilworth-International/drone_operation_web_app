import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

export const fuelTransportVoucherApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createFuelTransportVoucher: builder.mutation({
      queryFn: async (body) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/fuel-transport-vouchers/create', method: 'POST', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['FuelTransportVouchers', 'FinancialCards', 'Transactions'],
    }),

    getPendingFuelTransportVouchers: builder.query({
      queryFn: async () => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/fuel-transport-vouchers/pending', method: 'GET' },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data || [] };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['FuelTransportVouchers'],
    }),

    getFuelTransportVoucherHistory: builder.query({
      queryFn: async (params = {}) => {
        try {
          const search = new URLSearchParams();
          if (params.status) search.set('status', params.status);
          if (params.settled !== undefined && params.settled !== null && params.settled !== '') {
            search.set('settled', String(params.settled));
          }
          const months = Array.isArray(params.months)
            ? params.months.filter(Boolean).slice(0, 3)
            : params.month
              ? [params.month]
              : [];
          if (months.length) search.set('months', months.join(','));
          const qs = search.toString();
          const result = await nodeBackendBaseQuery(
            { url: `/api/fuel-transport-vouchers/history${qs ? `?${qs}` : ''}`, method: 'GET' },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data || [] };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['FuelTransportVouchers'],
    }),

    getFuelTransportVoucherById: builder.query({
      queryFn: async (id) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/fuel-transport-vouchers/${id}`, method: 'GET' },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: (_r, _e, id) => [{ type: 'FuelTransportVouchers', id }],
    }),

    approveFuelTransportVoucher: builder.mutation({
      queryFn: async (id) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/fuel-transport-vouchers/${id}/approve`, method: 'POST', body: {} },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['FuelTransportVouchers', 'FinancialCards', 'Transactions'],
    }),

    declineFuelTransportVoucher: builder.mutation({
      queryFn: async ({ id, reason }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/fuel-transport-vouchers/${id}/decline`, method: 'POST', body: { reason } },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['FuelTransportVouchers', 'FinancialCards', 'Transactions'],
    }),

    declineFuelTransportVoucherByFinance: builder.mutation({
      queryFn: async ({ transaction_ids: transactionIds, reason }) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: '/api/fuel-transport-vouchers/finance-decline',
              method: 'POST',
              body: { transaction_ids: transactionIds, reason },
            },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['FuelTransportVouchers', 'FinancialCards', 'Transactions'],
    }),

    recordFuelTransportPhysicalApproval: builder.mutation({
      queryFn: async ({ id, ...body }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/fuel-transport-vouchers/${id}/physical-approval`, method: 'POST', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['FuelTransportVouchers', 'FinancialCards', 'Transactions'],
    }),

    settleFuelTransportVoucher: builder.mutation({
      queryFn: async ({ id, ...body }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/fuel-transport-vouchers/${id}/settle`, method: 'POST', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['FuelTransportVouchers', 'FinancialCards', 'FinancialCardTransactions', 'Transactions'],
    }),
  }),
});

export const {
  useCreateFuelTransportVoucherMutation,
  useGetPendingFuelTransportVouchersQuery,
  useGetFuelTransportVoucherHistoryQuery,
  useGetFuelTransportVoucherByIdQuery,
  useApproveFuelTransportVoucherMutation,
  useDeclineFuelTransportVoucherMutation,
  useDeclineFuelTransportVoucherByFinanceMutation,
  useRecordFuelTransportPhysicalApprovalMutation,
  useSettleFuelTransportVoucherMutation,
} = fuelTransportVoucherApi;
