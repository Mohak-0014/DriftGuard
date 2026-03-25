import React, { createContext, useContext, useState, useEffect } from 'react';
import { isAuthenticated as checkAuth, login as apiLogin, signup as apiSignup, logout as apiLogout } from '../services/authService';


interface AuthContextType {
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string) => Promise<void>;
    logout: () => void;
    token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        const isAuth = checkAuth();
        setIsAuthenticated(isAuth);
        setToken(localStorage.getItem('token'));
    }, []);

    const login = async (email: string, password: string) => {
        const data = await apiLogin(email, password);
        if (data.access_token) {
            setIsAuthenticated(true);
            setToken(data.access_token);
        }
    };

    const signup = async (email: string, password: string) => {
        await apiSignup(email, password);
    };

    const logout = () => {
        apiLogout();
        setIsAuthenticated(false);
        setToken(null);
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, signup, logout, token }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
