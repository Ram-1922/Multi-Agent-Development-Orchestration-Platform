import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

function useFetch() {
    const [agents, setAgents] = useState([]);
    const { backend, token, logout } = useAuth(); 

    useEffect(() => {
        const headers = { 'Content-Type': 'application/json' };
        
        // Attach token if the user is logged in
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        fetch(`${backend}/api/dashboard/agents`, {
            method: 'GET',
            headers: headers
        })
        .then(response => {
            if (response.status === 401) {
                // If backend rejects the token, log them out
                logout(); 
                throw new Error("Unauthorized");
            }
            return response.json();
        })
        .then(data => setAgents(data))
        .catch(err => console.log("Fetch error:", err));
    }, [backend, token, logout]); 

    return agents;
}

export default useFetch;