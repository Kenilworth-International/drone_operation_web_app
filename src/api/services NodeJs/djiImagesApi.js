import { baseApi } from '../baseApi';
import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getNodeBackendUrl, getToken } from './nodeBackendConfig';

// Custom base query for Node.js backend (with special handling for file uploads)
const nodeBackendBaseQuery = fetchBaseQuery({
  baseUrl: getNodeBackendUrl(),
  prepareHeaders: (headers, { endpoint }) => {
    const token = getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    // For file upload, don't set Content-Type (let browser set it with boundary)
    if (endpoint !== 'uploadDjiImage') {
      headers.set('Content-Type', 'application/json');
    }
    return headers;
  },
});

export const djiImagesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Upload DJI image
    uploadDjiImage: builder.mutation({
      queryFn: async (formData, api, extraOptions, baseQuery) => {
        const token = getToken();
        try {
          const response = await fetch(`${getNodeBackendUrl()}/api/dji-images/upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            body: formData,
          });

          const raw = await response.text();
          let data;
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch {
            data = { error: raw || 'Upload failed' };
          }

          if (!response.ok) {
            return { error: { status: response.status, data } };
          }

          return { data };
        } catch (e) {
          return {
            error: {
              status: 'FETCH_ERROR',
              data: { error: e?.message || 'Network error while uploading image' },
            },
          };
        }
      },
      invalidatesTags: ['DjiImages'],
    }),

    // Get unlinked DJI images for a date
    getUnlinkedDjiImages: builder.query({
      queryFn: async (date, api, extraOptions, baseQuery) => {
        return nodeBackendBaseQuery(
          { url: `/api/dji-images/unlinked/${date}`, method: 'GET' },
          api,
          extraOptions
        );
      },
      providesTags: ['DjiImages'],
    }),

    // Get all DJI images with filters
    getAllDjiImages: builder.query({
      queryFn: async (filters = {}, api, extraOptions, baseQuery) => {
        const params = new URLSearchParams();
        Object.keys(filters).forEach(key => {
          if (filters[key] !== undefined && filters[key] !== null) {
            params.append(key, filters[key]);
          }
        });
        const queryString = params.toString();
        const url = `/api/dji-images${queryString ? `?${queryString}` : ''}`;
        const primary = await nodeBackendBaseQuery(
          { url, method: 'GET' },
          api,
          extraOptions
        );
        // Frontend fallback for intermittent proxy errors on some clients:
        // if filtered by date and generic list endpoint fails, try unlinked-by-date endpoint.
        const status = primary?.error?.status;
        const canFallback = Boolean(filters?.date) && (status === 502 || status === 'FETCH_ERROR');
        if (!primary?.error || !canFallback) return primary;
        const fallback = await nodeBackendBaseQuery(
          { url: `/api/dji-images/unlinked/${filters.date}`, method: 'GET' },
          api,
          extraOptions
        );
        return fallback?.error ? primary : fallback;
      },
      providesTags: ['DjiImages'],
    }),

    // Get DJI image by ID
    getDjiImageById: builder.query({
      queryFn: async (id, api, extraOptions, baseQuery) => {
        return nodeBackendBaseQuery(
          { url: `/api/dji-images/${id}`, method: 'GET' },
          api,
          extraOptions
        );
      },
      providesTags: (result, error, id) => [{ type: 'DjiImages', id }],
    }),

    // Update DJI image
    updateDjiImage: builder.mutation({
      queryFn: async ({ id, ...data }, api, extraOptions, baseQuery) => {
        return nodeBackendBaseQuery(
          {
            url: `/api/dji-images/${id}`,
            method: 'PUT',
            body: data,
          },
          api,
          extraOptions
        );
      },
      invalidatesTags: (result, error, { id }) => [{ type: 'DjiImages', id }, 'DjiImages'],
    }),

    // Link DJI image to task
    linkDjiImageToTask: builder.mutation({
      queryFn: async ({ imageId, taskId }, api, extraOptions, baseQuery) => {
        return nodeBackendBaseQuery(
          {
            url: '/api/dji-images/link',
            method: 'POST',
            body: { imageId, taskId },
          },
          api,
          extraOptions
        );
      },
      invalidatesTags: ['DjiImages'],
    }),

    // Delete DJI image
    deleteDjiImage: builder.mutation({
      queryFn: async (id, api, extraOptions, baseQuery) => {
        return nodeBackendBaseQuery(
          { url: `/api/dji-images/${id}`, method: 'DELETE' },
          api,
          extraOptions
        );
      },
      invalidatesTags: ['DjiImages'],
    }),

    // Get count of DJI images uploaded today
    getTodayDjiImagesCount: builder.query({
      queryFn: async () => {
        return nodeBackendBaseQuery(
          { url: '/api/dji-images/today-count', method: 'POST', body: {} },
          {},
          {}
        );
      },
      providesTags: ['DjiImagesCount'],
    }),

    // Day-end automation outcomes (done / skipped / incomplete) for a date
    getDjiDayEndAutomationLog: builder.query({
      queryFn: async ({ date, status } = {}, api, extraOptions) => {
        return nodeBackendBaseQuery(
          {
            url: '/api/dji-dayend-automation/log',
            method: 'POST',
            body: { date, ...(status ? { status } : {}) },
          },
          api,
          extraOptions
        );
      },
      providesTags: ['DjiImages'],
    }),
  }),
});

export const {
  useUploadDjiImageMutation,
  useGetUnlinkedDjiImagesQuery,
  useGetAllDjiImagesQuery,
  useGetDjiImageByIdQuery,
  useUpdateDjiImageMutation,
  useLinkDjiImageToTaskMutation,
  useDeleteDjiImageMutation,
  useGetTodayDjiImagesCountQuery,
  useGetDjiDayEndAutomationLogQuery,
} = djiImagesApi;

