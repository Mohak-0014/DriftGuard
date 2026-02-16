import api from '../api/axios';

export interface User {
    email: string;
    id: number;
}

export interface AuthResponse {
    access_token: string;
    token_type: string;
}

export const login = async (email: string, password: string): Promise<AuthResponse> => {
    // OAuth2PasswordRequestForm expects application/x-www-form-urlencoded
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await api.post<AuthResponse>('/auth/token', formData, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    if (response.data.access_token) {
        localStorage.setItem('token', response.data.access_token);
    }
    return response.data;
};

export const signup = async (email: string, password: string): Promise<User> => {
    const response = await api.post<User>('/auth/signup', { email, password });
    return response.data;
};

export const logout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
};

export const isAuthenticated = (): boolean => {
    return !!localStorage.getItem('token');
};

export const getToken = (): string | null => {
    return localStorage.getItem('token');
};
