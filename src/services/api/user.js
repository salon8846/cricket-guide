import request from '@/services/request';

export const userApi = {
    login: (credentials) => request.post('/user/login', credentials),
    getProfile: () => request.get('/user/profile'),
    updateProfile: (profileChanges) => request.put('/user/profile', profileChanges),
    logout: () => request.post('/user/logout'),
};
