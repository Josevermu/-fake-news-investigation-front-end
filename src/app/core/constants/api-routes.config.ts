export const API_ROUTES = {
  admin: {
    exportCsv: '/admin/export/csv',
  },
  participants: {
    register: '/participants/register',
    getById: (id: number) => `/participants/${id}`,
    submitBatch: (id: number) => `/participants/${id}/answers/batch`,
  },
} as const;
