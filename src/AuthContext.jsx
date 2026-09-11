import { Children, createContext,useContext, useState } from "react";

const AuthContext = createContext();

export const AuthProvider = ({children})=>{
    const [Logged, setLogged] = useState(true);
    const backend = "http://localhost:8000";

    return(
        <AuthContext.Provider value={{Logged,setLogged,backend}}>{children}</AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);