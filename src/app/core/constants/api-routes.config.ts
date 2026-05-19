export const API_ROUTES = {
  participants: {
    register: '/participants/register',
    getById: (id: number) => `/participants/${id}`,
    submitBatch: (id: number) => `/participants/${id}/answers/batch`,
  },
} as const;
