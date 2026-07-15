import request from '@/services/request';

export const exampleApi = {
    getList: (query) => request.get('/example/list', { params: query }),
    getDetail: (resourceId) => request.get(`/example/${resourceId}`),
    create: (draft) => request.post('/example', draft),
    update: (resourceId, changes) => request.put(`/example/${resourceId}`, changes),
    remove: (resourceId) => request.delete(`/example/${resourceId}`),
};
