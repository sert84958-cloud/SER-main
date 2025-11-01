import React, { createContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from './components/ui/sonner';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import UserDashboard from './pages/UserDashboard';
import TraderDashboard from './pages/TraderDashboard';
import AdminDashboard from './pages/AdminDashboard';
import './App.css';

export const AuthContext = createContext();

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        setUser(res.data);
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem('token');
        setToken(null);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <AuthContext.Provider value={{ user, token, login, logout, API_URL }}>
        <Router>
          <div className="App">
            <Routes>
              <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
              <Route
                path="/dashboard"
                element={
                  user ? (
                    user.role === 'admin' ? (
                      <AdminDashboard />
                    ) : user.role === 'trader' ? (
                      <TraderDashboard />
                    ) : (
                      <UserDashboard />
                    )
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />
              <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
            </Routes>
            <Toaster position="top-right" richColors />
          </div>
        </Router>
      </AuthContext.Provider>
    </ThemeProvider>
  );
}

export default App;