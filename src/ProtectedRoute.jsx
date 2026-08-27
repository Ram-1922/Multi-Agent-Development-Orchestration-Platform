import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

const ProtectedRoute = () => {
    const { Logged } = useAuth();

    // If not logged in, redirect them immediately to the login route
    // The 'replace' prop prevents them from using the back button to return to the protected page
    if (!Logged) {
        return <Navigate to="/login" replace />;
    }

    // If logged in, allow them through
    return <Outlet />;
};

export default ProtectedRoute;