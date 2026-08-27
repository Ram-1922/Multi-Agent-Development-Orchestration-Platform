import { useState } from 'react'
import './App.css'
import Dashboard from './Dashboard'
import Login from './Login'
import { createBrowserRouter,RouterProvider } from 'react-router-dom'
import AgentBuilder from './AgentBuilder'
import Playground from './Playground'
import KnowledgeBase from './Knowledgebase'
import Home from './Home'
import { AuthProvider } from './AuthContext'
import ProtectedRoute from './ProtectedRoute'

const routes = createBrowserRouter([
  {
    path:'/login',
    element:<Login/>
  },
  {
    path:'/',
    element:<Home/>,
    children:[
        {
          index:true,
          element:<Dashboard />
        },
        {
          element:<ProtectedRoute/>,
          children:[
            {
              path:'/agents/new',
              element:<AgentBuilder/>
            },
            {
              path:'/playground/:id',
              element:<Playground/>
            },
            {
              path:'/knowledgebase',
              element:<KnowledgeBase/>
            }
          ]
        }
      ]
    }
  
])

function App() {
  const [count, setCount] = useState(0);


  return (
    <>
    <AuthProvider>
        <RouterProvider router={routes} />
    </AuthProvider>
    </>
  )
}

export default App
