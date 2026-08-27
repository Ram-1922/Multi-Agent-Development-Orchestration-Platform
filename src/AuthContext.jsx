import { Children, createContext,useContext, useState } from "react";

const AuthContext = createContext();

export const AuthProvider = ({children})=>{
    const [Logged, setLogged] = useState(false);

    return(
        <AuthContext.Provider value={{Logged,setLogged}}>{children}</AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);