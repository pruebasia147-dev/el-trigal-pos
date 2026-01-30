import React, { useEffect, useState } from 'react';
import Login from './components/Login';
import SellerView from './components/SellerView';
import AdminDashboard from './components/AdminDashboard';
import { db } from './services/db';
import { User } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initApp = async () => {
      await db.init();
      setIsLoading(false);
    };
    initApp();
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="text-orange-600 font-bold text-xl animate-pulse">
          Cargando Sistema El Trigal...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (user.role === 'admin') {
    return <AdminDashboard onLogout={handleLogout} />;
  }

  return <SellerView user={user} onLogout={handleLogout} />;
};

export default App;