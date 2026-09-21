import { createContext, useContext, useState } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(() => localStorage.getItem("access_token") || null);
    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem("user");
        return savedUser ? JSON.parse(savedUser) : null;
    });
    const [Logged, setLogged] = useState(() => !!localStorage.getItem("access_token"));
    const backend = "http://localhost:8000";

    const login = (newToken, userData) => {
        setToken(newToken);
        setUser(userData);
        setLogged(true);
        localStorage.setItem("access_token", newToken);
        localStorage.setItem("user", JSON.stringify(userData));
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        setLogged(false);
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
    };

    return (
        <AuthContext.Provider value={{ token, user, Logged, setLogged, backend, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);