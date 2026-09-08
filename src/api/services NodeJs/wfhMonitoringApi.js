import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery, getNodeBackendUrl, getToken } from './nodeBackendConfig';

export const wfhMonitoringApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listWfhCaptures: builder.query({
      queryFn: async (body = {}) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/wfh-monitoring/admin/captures', method: 'POST', body: body || {} },
          {},
          {},
        );
        if (result.error) return result;
        return { data: result.data?.data || { items: [], total: 0 } };
      },
      providesTags: ['WfhMonitoring'],
    }),
    listWfhDevices: builder.query({
      queryFn: async (body = {}) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/wfh-monitoring/admin/devices', method: 'POST', body: body || {} },
          {},
          {},
        );
        if (result.error) return result;
        return { data: result.data?.data || { devices: [], sessions: [] } };
      },
      providesTags: ['WfhMonitoring'],
    }),
  }),
});

export function getWfhCaptureFileUrl(captureId) {
  const base = getNodeBackendUrl() || '';
  return `${base}/api/wfh-monitoring/admin/captures/${captureId}/file`;
}

export async function fetchWfhCaptureBlob(captureId) {
  const token = getToken();
  const res = await fetch(getWfhCaptureFileUrl(captureId), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    // Allow browser HTTP cache (server sends Cache-Control: private, max-age=3600)
    cache: 'default',
  });
  if (!res.ok) {
    throw new Error('Failed to load capture image');
  }
  return res.blob();
}

export const {
  useListWfhCapturesQuery,
  useListWfhDevicesQuery,
} = wfhMonitoringApi;
