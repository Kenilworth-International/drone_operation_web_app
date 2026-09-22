import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery, getNodeBackendUrl, getToken } from './nodeBackendConfig';

const postQuery = async (url, body = {}) => nodeBackendBaseQuery(
  {
    url,
    method: 'POST',
    body,
  },
  {},
  {}
);

const postFormData = async (url, formData) => {
  const baseUrl = getNodeBackendUrl();
  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${url}`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: { status: res.status, data: data?.message || data?.error || 'Request failed' } };
  }
  return { data };
};

export const centralProcurementApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getStockWings: builder.query({
      queryFn: async () => {
        const result = await postQuery('/api/stock-assets/wings', {});
        if (result.error) return { error: result.error };
        return { data: result.data?.data || [] };
      },
    }),
    getStockSectors: builder.query({
      queryFn: async () => {
        const result = await postQuery('/api/stock-assets/sectors', {});
        if (result.error) return { error: result.error };
        return { data: result.data?.data || [] };
      },
    }),

    // Central stores
    getCentralStoreRequests: builder.query({
      queryFn: async (filters = {}) => {
        const result = await postQuery('/api/stock-assets/central-stores/requests', filters);
        if (result.error) return { error: result.error };
        return { data: result.data?.data || [] };
      },
      providesTags: ['CentralStoreRequests'],
    }),
    getCentralStoreRequestQueue: builder.query({
      queryFn: async (filters = {}) => {
        const result = await postQuery('/api/stock-assets/central-stores/request-queue', filters);
        if (result.error) return { error: result.error };
        return { data: result.data?.data || [] };
      },
      providesTags: ['CentralStoreRequests'],
    }),
    getCentralStoreRequest: builder.query({
      queryFn: async (id) => {
        const result = await postQuery('/api/stock-assets/central-stores/requests/view', { id });
        if (result.error) return { error: result.error };
        return { data: result.data?.data || null };
      },
    }),
    createCentralStoreRequest: builder.mutation({
      queryFn: async (payload) => {
        const result = await postQuery('/api/stock-assets/central-stores/requests/create', payload);
        return result.error ? { error: result.error } : { data: result.data?.data || null };
      },
      invalidatesTags: ['CentralStoreRequests', 'WorkshopInventory'],
    }),
    issueCentralStoreItems: builder.mutation({
      queryFn: async (payload) => {
        const result = await postQuery('/api/stock-assets/central-stores/requests/issue', payload);
        return result.error ? { error: result.error } : { data: result.data?.data || null };
      },
      invalidatesTags: ['CentralStoreRequests', 'WorkshopInventory'],
    }),

    getStockTransfers: builder.query({
      queryFn: async (filters = {}) => {
        const result = await postQuery('/api/stock-assets/stock-transfers', filters);
        if (result.error) return { error: result.error };
        return { data: result.data?.data || [] };
      },
      providesTags: ['StockTransfers'],
    }),
    createStockTransfer: builder.mutation({
      queryFn: async (payload) => {
        const result = await postQuery('/api/stock-assets/stock-transfers/create', payload);
        return result.error ? { error: result.error } : { data: result.data?.data || null };
      },
      invalidatesTags: ['StockTransfers', 'WorkshopInventory'],
    }),
    getWorkshopStockAvailability: builder.query({
      queryFn: async (filters = {}) => {
        const result = await postQuery('/api/stock-assets/stock-transfers/stock-availability', filters);
        if (result.error) return { error: result.error };
        return { data: result.data?.data || [] };
      },
    }),
    sendRequestToNeedToProcure: builder.mutation({
      queryFn: async (payload) => {
        const result = await postQuery('/api/stock-assets/central-stores/requests/send-to-procure', payload);
        return result.error ? { error: result.error } : { data: result.data?.data || null };
      },
    }),
    getNeedToProcureQueue: builder.query({
      queryFn: async (filters = {}) => {
        const result = await postQuery('/api/stock-assets/central-stores/need-to-procure', filters);
        if (result.error) return { error: result.error };
        return { data: result.data?.data || [] };
      },
    }),

    // Procurement
    getProcurementRequests: builder.query({
      queryFn: async (filters = {}) => {
        const result = await postQuery('/api/stock-assets/procurement/requests', filters);
        if (result.error) return { error: result.error };
        return { data: result.data?.data || [] };
      },
    }),
    getProcurementRequest: builder.query({
      queryFn: async (id) => {
        const result = await postQuery('/api/stock-assets/procurement/requests/view', { id });
        if (result.error) return { error: result.error };
        return { data: result.data?.data || null };
      },
    }),
    createProcurementRequest: builder.mutation({
      queryFn: async (payload) => {
        const result = await postQuery('/api/stock-assets/procurement/requests/create', payload);
        return result.error ? { error: result.error } : { data: result.data?.data || null };
      },
    }),
    updateProcurementRequestStatus: builder.mutation({
      queryFn: async (payload) => {
        const result = await postQuery('/api/stock-assets/procurement/requests/update-status', payload);
        return result.error ? { error: result.error } : { data: result.data?.data || null };
      },
    }),
    getApprovedProcureQueue: builder.query({
      queryFn: async (filters = {}) => {
        const result = await postQuery('/api/stock-assets/procurement/approved-queue', filters);
        if (result.error) return { error: result.error };
        return { data: result.data?.data || [] };
      },
    }),

    // RFQ and quotations
    getRfqs: builder.query({
      queryFn: async (filters = {}) => {
        const result = await postQuery('/api/stock-assets/procurement/rfqs', filters);
        if (result.error) return { error: result.error };
        return { data: result.data?.data || [] };
      },
    }),
    createRfq: builder.mutation({
      queryFn: async (payload) => {
        const result = await postQuery('/api/stock-assets/procurement/rfqs/create', payload);
        return result.error ? { error: result.error } : { data: result.data?.data || null };
      },
    }),
    getPendingQuotationsQueue: builder.query({
      queryFn: async (filters = {}) => {
        const result = await postQuery('/api/stock-assets/procurement/pending-quotations', filters);
        if (result.error) return { error: result.error };
        return { data: result.data?.data || [] };
      },
    }),
    getSupplierQuotations: builder.query({
      queryFn: async (filters = {}) => {
        const result = await postQuery('/api/stock-assets/procurement/quotations', filters);
        if (result.error) return { error: result.error };
        return { data: result.data?.data || [] };
      },
    }),
    getQuotation: builder.query({
      queryFn: async (id) => {
        const result = await postQuery('/api/stock-assets/procurement/quotations/view', { id });
        if (result.error) return { error: result.error };
        return { data: result.data?.data || null };
      },
    }),
    createSupplierQuotation: builder.mutation({
      queryFn: async (payload) => {
        const { file, items, ...rest } = payload;
        if (file && file instanceof File) {
          const formData = new FormData();
          Object.entries(rest).forEach(([k, v]) => {
            if (v != null && v !== '') formData.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
          });
          if (Array.isArray(items) && items.length) formData.append('items', JSON.stringify(items));
          formData.append('scanned_document', file);
          const result = await postFormData('/api/stock-assets/procurement/quotations/create', formData);
          return result.error ? { error: result.error } : { data: result.data?.data || null };
        }
        const result = await postQuery('/api/stock-assets/procurement/quotations/create', { ...rest, items });
        return result.error ? { error: result.error } : { data: result.data?.data || null };
      },
    }),
    saveQuotationEvaluation: builder.mutation({
      queryFn: async (payload) => {
        const result = await postQuery('/api/stock-assets/procurement/quotations/evaluate', payload);
        return result.error ? { error: result.error } : { data: result.data?.data || null };
      },
    }),
    saveTechnicalEvaluation: builder.mutation({
      queryFn: async (payload) => {
        const result = await postQuery('/api/stock-assets/procurement/quotations/technical-evaluate', payload);
        return result.error ? { error: result.error } : { data: result.data?.data || null };
      },
    }),
    finalizeQuotation: builder.mutation({
      queryFn: async (payload) => {
        const result = await postQuery('/api/stock-assets/procurement/quotations/finalize', payload);
        return result.error ? { error: result.error } : { data: result.data?.data || null };
      },
    }),

    // PO + GRN
    getPurchaseOrders: builder.query({
      queryFn: async (filters = {}) => {
        const result = await postQuery('/api/stock-assets/procurement/purchase-orders', filters || {});
        if (result.error) return { error: result.error };
        const list = result.data?.data ?? result.data;
        return { data: Array.isArray(list) ? list : [] };
      },
    }),
    getPurchaseOrder: builder.query({
      queryFn: async (id) => {
        const result = await postQuery('/api/stock-assets/procurement/purchase-orders/view', { id });
        if (result.error) return { error: result.error };
        return { data: result.data?.data || null };
      },
    }),
    createPurchaseOrder: builder.mutation({
      queryFn: async (payload) => {
        const result = await postQuery('/api/stock-assets/procurement/purchase-orders/create', payload);
        return result.error ? { error: result.error } : { data: result.data?.data || null };
      },
    }),
    getGrns: builder.query({
      queryFn: async (filters = {}) => {
        const result = await postQuery('/api/stock-assets/procurement/grns', filters);
        if (result.error) return { error: result.error };
        return { data: result.data?.data || [] };
      },
    }),
    getGrn: builder.query({
      queryFn: async (id) => {
        const result = await postQuery('/api/stock-assets/procurement/grns/view', { id });
        if (result.error) return { error: result.error };
        return { data: result.data?.data || null };
      },
    }),
    createGrn: builder.mutation({
      queryFn: async (payload) => {
        const result = await postQuery('/api/stock-assets/procurement/grns/create', payload);
        return result.error ? { error: result.error } : { data: result.data?.data || null };
      },
    }),
  }),
});

export const {
  useGetStockWingsQuery,
  useGetStockSectorsQuery,
  useGetCentralStoreRequestsQuery,
  useGetCentralStoreRequestQueueQuery,
  useGetCentralStoreRequestQuery,
  useCreateCentralStoreRequestMutation,
  useIssueCentralStoreItemsMutation,
  useSendRequestToNeedToProcureMutation,
  useGetNeedToProcureQueueQuery,
  useGetProcurementRequestsQuery,
  useGetProcurementRequestQuery,
  useLazyGetProcurementRequestQuery,
  useCreateProcurementRequestMutation,
  useUpdateProcurementRequestStatusMutation,
  useGetApprovedProcureQueueQuery,
  useGetRfqsQuery,
  useCreateRfqMutation,
  useGetPendingQuotationsQueueQuery,
  useGetSupplierQuotationsQuery,
  useGetQuotationQuery,
  useLazyGetQuotationQuery,
  useCreateSupplierQuotationMutation,
  useSaveQuotationEvaluationMutation,
  useSaveTechnicalEvaluationMutation,
  useFinalizeQuotationMutation,
  useGetPurchaseOrdersQuery,
  useGetPurchaseOrderQuery,
  useLazyGetPurchaseOrderQuery,
  useCreatePurchaseOrderMutation,
  useGetGrnsQuery,
  useGetGrnQuery,
  useLazyGetGrnQuery,
  useCreateGrnMutation,
  useGetStockTransfersQuery,
  useCreateStockTransferMutation,
  useGetWorkshopStockAvailabilityQuery,
} = centralProcurementApi;
