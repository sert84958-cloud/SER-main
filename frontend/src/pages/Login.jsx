import React, { useState, useContext } from 'react';
import { AuthContext } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import SkiPayLogo from '../components/SkiPayLogo';
import ThemeToggle from '../components/ThemeToggle';

const Login = () => {
  const { login, API_URL } = useContext(AuthContext);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Пожалуйста, заполните все поля');
      return;
    }

    setLoading(true);
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const res = await axios.post(`${API_URL}${endpoint}`, { email, password });
      
      if (isLogin) {
        // Login flow
        login(res.data.token, res.data.user);
        toast.success('Добро пожаловать!');
      } else {
        // Registration flow - no token returned
        toast.success('Регистрация успешна! Ожидайте подтверждения от администратора.');
        setEmail('');
        setPassword('');
        setIsLogin(true); // Switch to login tab
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="glass-card rounded-2xl p-8 w-full max-w-md hover-lift animate-fade-in">
        <div className="text-center mb-8">
          <SkiPayLogo size="xlarge" className="mb-2 justify-center" />
          <p className="text-gray-600">Быстрые и безопасные платежи</p>
        </div>

        <div className="flex gap-2 mb-6">
          <Button
            variant={isLogin ? "default" : "outline"}
            className={`flex-1 btn-glass ${isLogin ? 'btn-primary' : 'border-purple-500/30 text-purple-300'}`}
            onClick={() => setIsLogin(true)}
          >
            Вход
          </Button>
          <Button
            variant={!isLogin ? "default" : "outline"}
            className={`flex-1 btn-glass ${!isLogin ? 'btn-primary' : 'border-purple-500/30 text-purple-300'}`}
            onClick={() => setIsLogin(false)}
          >
            Регистрация
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full glass-card border-gray-300"
            />
          </div>
          <div>
            <Input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full glass-card border-gray-300"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full btn-primary btn-glass"
          >
            {loading ? 'Загрузка...' : (isLogin ? 'Войти' : 'Зарегистрироваться')}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;