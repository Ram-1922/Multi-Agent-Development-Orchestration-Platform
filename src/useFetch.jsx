import React, { useState,useEffect } from 'react'

function useFetch() {
    const [agents,setAgents] = useState([]);

  useEffect(()=>{
    fetch("http://localhost:8000/api/dashboard/agents").then(response=>response.json()).then(data=>setAgents(data)).catch(err=>console.log(err));
  },[])
  return (agents);
}

export default useFetch;