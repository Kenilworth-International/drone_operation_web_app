import { baseApi } from '../baseApi';
import { getNodeBackendUrl, getToken } from './nodeBackendUrl';
import { forceLogoutFromApi } from '../../utils/sessionUtils';

async function webmailJson(url, body, api) {
  const result = await fetch(`${getNodeBackendUrl()}${url}`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${getToken() || ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body || {}),
  });
  const json = await result.json().catch(() => ({}));
  if (!result.ok || json.status === false) {
    const error = { status: result.status, data: json };
    if (api) forceLogoutFromApi(api, error);
    return { error };
  }
  return { data: json.data !== undefined ? json.data : json };
}

async function webmailForm(url, formData, api) {
  const result = await fetch(`${getNodeBackendUrl()}${url}`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${getToken() || ''}`,
    },
    body: formData,
  });
  const json = await result.json().catch(() => ({}));
  if (!result.ok || json.status === false) {
    const error = { status: result.status, data: json };
    if (api) forceLogoutFromApi(api, error);
    return { error };
  }
  return { data: json.data !== undefined ? json.data : json };
}

export const webmailApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getWebmailStatus: builder.query({
      queryFn: async (_arg, api) => webmailJson('/api/webmail/status', {}, api),
      providesTags: ['Webmail'],
      keepUnusedDataFor: 0,
    }),
    connectWebmail: builder.mutation({
      queryFn: async (body, api) => webmailJson('/api/webmail/connect', body || {}, api),
      invalidatesTags: ['Webmail'],
    }),
    disconnectWebmail: builder.mutation({
      queryFn: async (_arg, api) => webmailJson('/api/webmail/disconnect', {}, api),
      invalidatesTags: ['Webmail', 'WebmailFolders', 'WebmailMessages'],
    }),
    getWebmailFolders: builder.query({
      queryFn: async (_arg, api) => webmailJson('/api/webmail/folders', {}, api),
      providesTags: ['WebmailFolders'],
    }),
    listWebmailMessages: builder.query({
      queryFn: async (body, api) => webmailJson('/api/webmail/messages/list', body || {}, api),
      providesTags: ['WebmailMessages'],
    }),
    getWebmailMessage: builder.query({
      queryFn: async (body, api) => webmailJson('/api/webmail/messages/get', body || {}, api),
    }),
    sendWebmailMessage: builder.mutation({
      queryFn: async ({ fields, files }, api) => {
        const fd = new FormData();
        Object.entries(fields || {}).forEach(([key, value]) => {
          if (value == null) return;
          if (Array.isArray(value)) fd.append(key, value.join(', '));
          else fd.append(key, String(value));
        });
        (files || []).forEach((file) => fd.append('attachments', file));
        return webmailForm('/api/webmail/messages/send', fd, api);
      },
      invalidatesTags: ['WebmailMessages'],
    }),
    saveWebmailDraft: builder.mutation({
      queryFn: async ({ fields, files }, api) => {
        const fd = new FormData();
        Object.entries(fields || {}).forEach(([key, value]) => {
          if (value == null) return;
          if (Array.isArray(value)) fd.append(key, value.join(', '));
          else fd.append(key, String(value));
        });
        (files || []).forEach((file) => fd.append('attachments', file));
        return webmailForm('/api/webmail/messages/draft', fd, api);
      },
      invalidatesTags: ['WebmailMessages'],
    }),
    retryWebmailOutbox: builder.mutation({
      queryFn: async (body, api) => webmailJson('/api/webmail/messages/outbox/retry', body || {}, api),
      invalidatesTags: ['WebmailMessages'],
    }),
    deleteWebmailOutbox: builder.mutation({
      queryFn: async (body, api) => webmailJson('/api/webmail/messages/outbox/delete', body || {}, api),
      invalidatesTags: ['WebmailMessages'],
    }),
    getWebmailSignature: builder.query({
      queryFn: async (_arg, api) => webmailJson('/api/webmail/signature/get', {}, api),
      providesTags: ['WebmailSignature'],
    }),
    saveWebmailSignature: builder.mutation({
      queryFn: async ({ fields, imageFile }, api) => {
        const fd = new FormData();
        Object.entries(fields || {}).forEach(([key, value]) => {
          if (value == null) return;
          fd.append(key, String(value));
        });
        if (imageFile) fd.append('image', imageFile);
        return webmailForm('/api/webmail/signature/save', fd, api);
      },
      invalidatesTags: ['WebmailSignature'],
    }),
    applyWebmailSignature: builder.mutation({
      queryFn: async (body, api) => webmailJson('/api/webmail/signature/apply', body || {}, api),
      invalidatesTags: ['WebmailSignature'],
    }),
    deleteWebmailSignature: builder.mutation({
      queryFn: async (body, api) => webmailJson('/api/webmail/signature/delete', body || {}, api),
      invalidatesTags: ['WebmailSignature'],
    }),
    listWebmailContacts: builder.query({
      queryFn: async (body, api) => webmailJson('/api/webmail/contacts/list', body || {}, api),
      providesTags: ['WebmailContacts'],
    }),
    saveWebmailContact: builder.mutation({
      queryFn: async (body, api) => webmailJson('/api/webmail/contacts/save', body || {}, api),
      invalidatesTags: ['WebmailContacts'],
    }),
    deleteWebmailContact: builder.mutation({
      queryFn: async (body, api) => webmailJson('/api/webmail/contacts/delete', body || {}, api),
      invalidatesTags: ['WebmailContacts'],
    }),
  }),
});

export async function downloadWebmailAttachment({ folder, uid, index, filename }) {
  const result = await fetch(`${getNodeBackendUrl()}/api/webmail/messages/attachment`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${getToken() || ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ folder, uid, index }),
  });
  if (!result.ok) {
    const json = await result.json().catch(() => ({}));
    throw new Error(json.message || 'Download failed');
  }
  const blob = await result.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'attachment';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const {
  useGetWebmailStatusQuery,
  useConnectWebmailMutation,
  useDisconnectWebmailMutation,
  useGetWebmailFoldersQuery,
  useLazyGetWebmailFoldersQuery,
  useListWebmailMessagesQuery,
  useLazyListWebmailMessagesQuery,
  useLazyGetWebmailMessageQuery,
  useSendWebmailMessageMutation,
  useSaveWebmailDraftMutation,
  useRetryWebmailOutboxMutation,
  useDeleteWebmailOutboxMutation,
  useGetWebmailSignatureQuery,
  useSaveWebmailSignatureMutation,
  useApplyWebmailSignatureMutation,
  useDeleteWebmailSignatureMutation,
  useListWebmailContactsQuery,
  useSaveWebmailContactMutation,
  useDeleteWebmailContactMutation,
} = webmailApi;
