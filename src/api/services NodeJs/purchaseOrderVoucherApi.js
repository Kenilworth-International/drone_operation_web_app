import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

export const purchaseOrderVoucherApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getEligiblePurchaseOrders: builder.query({
      queryFn: async (params = {}) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: '/api/purchase-order-vouchers/eligible',
              method: 'POST',
              body: {
                search: params.search || '',
                status: params.status || 'all',
                month: params.month || null,
              },
            },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data || [] };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['PurchaseOrderVouchers'],
    }),

    createPurchaseOrderVoucher: builder.mutation({
      queryFn: async (body) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/purchase-order-vouchers/create', method: 'POST', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['PurchaseOrderVouchers', 'VoucherPayments', 'StrategicFinanceApprovals'],
    }),

    financeDeclinePurchaseOrders: builder.mutation({
      queryFn: async (body) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/purchase-order-vouchers/finance-decline', method: 'POST', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['PurchaseOrderVouchers', 'StrategicFinanceApprovals'],
    }),

    getPendingPurchaseOrderVouchers: builder.query({
      queryFn: async () => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/purchase-order-vouchers/pending', method: 'GET' },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data || [] };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['PurchaseOrderVouchers', 'StrategicFinanceApprovals'],
    }),

    getPurchaseOrderVoucherHistory: builder.query({
      queryFn: async (params = {}) => {
        try {
          const search = new URLSearchParams();
          if (params.status) search.set('status', params.status);
          if (params.settled !== undefined && params.settled !== null && params.settled !== '') {
            search.set('settled', String(params.settled));
          }
          if (params.month) search.set('month', String(params.month));
          const qs = search.toString();
          const result = await nodeBackendBaseQuery(
            { url: `/api/purchase-order-vouchers/history${qs ? `?${qs}` : ''}`, method: 'GET' },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data || [] };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['PurchaseOrderVouchers'],
    }),

    getPurchaseOrderVoucherById: builder.query({
      queryFn: async (id) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/purchase-order-vouchers/${id}`, method: 'GET' },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: (_r, _e, id) => [{ type: 'PurchaseOrderVouchers', id }],
    }),

    approvePurchaseOrderVoucher: builder.mutation({
      queryFn: async (id) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/purchase-order-vouchers/${id}/approve`, method: 'POST', body: {} },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['PurchaseOrderVouchers', 'VoucherPayments', 'StrategicFinanceApprovals'],
    }),

    declinePurchaseOrderVoucher: builder.mutation({
      queryFn: async ({ id, reason }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/purchase-order-vouchers/${id}/decline`, method: 'POST', body: { reason } },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['PurchaseOrderVouchers', 'StrategicFinanceApprovals'],
    }),

    recordPurchaseOrderVoucherPhysicalApproval: builder.mutation({
      queryFn: async ({ id, ...body }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/purchase-order-vouchers/${id}/physical-approval`, method: 'POST', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['PurchaseOrderVouchers', 'VoucherPayments', 'StrategicFinanceApprovals'],
    }),
  }),
});

export const {
  useGetEligiblePurchaseOrdersQuery,
  useCreatePurchaseOrderVoucherMutation,
  useFinanceDeclinePurchaseOrdersMutation,
  useGetPendingPurchaseOrderVouchersQuery,
  useGetPurchaseOrderVoucherHistoryQuery,
  useGetPurchaseOrderVoucherByIdQuery,
  useApprovePurchaseOrderVoucherMutation,
  useDeclinePurchaseOrderVoucherMutation,
  useRecordPurchaseOrderVoucherPhysicalApprovalMutation,
} = purchaseOrderVoucherApi;
