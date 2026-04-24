import { useState, useEffect } from 'react';
import { UserProfile } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('prospect_user');
    if (savedUser) {
      const u = JSON.parse(savedUser);
      setUser(u);
      setProfile({
        email: u.email,
        role: 'admin',
        displayName: 'Akash Admin'
      });
    }
  }, []);

  const handleLogin = (email: string, password: string) => {
    if (email === 'akash@prospect.com' && password === 'prospect2026') {
      const u = { email };
      setUser(u);
      setProfile({
        email,
        role: 'admin',
        displayName: 'Akash Admin'
      });
      localStorage.setItem('prospect_user', JSON.stringify(u));
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setUser(null);
    setProfile(null);
    localStorage.removeItem('prospect_user');
  };

  return {
    user,
    profile,
    loading,
    handleLogin,
    handleLogout
  };
}
