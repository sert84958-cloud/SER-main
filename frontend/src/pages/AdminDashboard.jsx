import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Users, CreditCard, Settings, TrendingUp, LogOut, Plus, Ban, DollarSign } from 'lucide-react';
import SkiPayLogo from '../components/SkiPayLogo';
import ThemeToggle from '../components/ThemeToggle';

const AdminDashboard = () => {
  const { user, token, logout, API_URL } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [traders, setTraders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState({ commission_rate: 9, usd_to_uah_rate: 41.5, deposit_wallet_address: '' });
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddBalance, setShowAddBalance] = useState(false);
  const [selectedTrader, setSelectedTrader] = useState(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'user' });
  const [pendingUsers, setPendingUsers] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);

  useEffect(() => {
    fetchAll();
    
    // Автообновление данных каждые 5 секунд
    const interval = setInterval(() => {
      fetchTransactions();
      fetchPendingUsers();
      fetchStats();
      fetchWithdrawals();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchAll = () => {
    fetchUsers();
    fetchTraders();
    fetchTransactions();
    fetchStats();
    fetchSettings();
    fetchPendingUsers();
    fetchWithdrawals();
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data);
    } catch (error) {
      toast.error('Ошибка загрузки пользователей');
    }
  };

  const fetchTraders = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/traders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTraders(res.data);
    } catch (error) {
      toast.error('Ошибка загрузки трейдеров');
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransactions(res.data);
    } catch (error) {
      toast.error('Ошибка загрузки транзакций');
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data);
    } catch (error) {
      console.error('Ошибка загрузки статистики');
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSettings(res.data);
    } catch (error) {
      console.error('Ошибка загрузки настроек');
    }
  };

  const fetchPendingUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/users/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingUsers(res.data);
    } catch (error) {
      console.error('Ошибка загрузки ожидающих пользователей');
    }
  };

  const fetchWithdrawals = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/withdrawals`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWithdrawals(res.data);
    } catch (error) {
      console.error('Ошибка загрузки заявок на вывод');
    }
  };

  const approveWithdrawal = async (withdrawalId) => {
    try {
      await axios.put(
        `${API_URL}/api/admin/withdrawals/${withdrawalId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Заявка одобрена');
      fetchWithdrawals();
    } catch (error) {
      toast.error('Ошибка одобрения заявки');
    }
  };

  const rejectWithdrawal = async (withdrawalId) => {
    try {
      await axios.put(
        `${API_URL}/api/admin/withdrawals/${withdrawalId}/reject`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Заявка отклонена');
      fetchWithdrawals();
    } catch (error) {
      toast.error('Ошибка отклонения заявки');
    }
  };

  const updateSettings = async () => {
    try {
      await axios.put(
        `${API_URL}/api/admin/settings`,
        settings,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Настройки обновлены!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка обновления настроек');
    }
  };

  const createUser = async () => {
    if (!newUser.email || !newUser.password) {
      toast.error('Заполните все поля');
      return;
    }

    try {
      const res = await axios.post(
        `${API_URL}/api/admin/users/create`,
        newUser,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Пользователь создан! Пароль: ${res.data.user.password}`);
      setShowAddUser(false);
      setNewUser({ email: '', password: '', role: 'user' });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка создания пользователя');
    }
  };

  const blockUser = async (userId) => {
    try {
      await axios.put(
        `${API_URL}/api/admin/users/${userId}/block`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Статус пользователя изменён');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка');
    }
  };

  const blockTrader = async (traderId) => {
    try {
      await axios.put(
        `${API_URL}/api/admin/traders/${traderId}/block`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Статус трейдера изменён');
      fetchTraders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка');
    }
  };

  const addBalance = async () => {
    if (!balanceAmount || parseFloat(balanceAmount) <= 0) {
      toast.error('Введите корректную сумму');
      return;
    }

    try {
      await axios.post(
        `${API_URL}/api/admin/traders/${selectedTrader.id}/add-balance`,
        { amount: parseFloat(balanceAmount) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Баланс пополнен!');
      setShowAddBalance(false);
      setBalanceAmount('');
      setSelectedTrader(null);
      fetchTraders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка пополнения');
    }
  };

  const approveUser = async (userId) => {
    try {
      await axios.put(
        `${API_URL}/api/admin/users/${userId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Пользователь одобрен!');
      fetchPendingUsers();
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка одобрения');
    }
  };

  const rejectUser = async (userId) => {
    if (!window.confirm('Отклонить регистрацию? Аккаунт будет удален.')) return;
    
    try {
      await axios.delete(
        `${API_URL}/api/admin/users/${userId}/reject`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Регистрация отклонена');
      fetchPendingUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка');
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="glass-card rounded-2xl p-6 mb-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <SkiPayLogo size="large" />
                <span className="text-2xl font-bold gradient-text">Admin</span>
              </div>
              <p className="text-gray-600 mt-1">{user.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Button variant="outline" onClick={logout} className="glass-card">
                <LogOut className="mr-2 h-4 w-4" />
                Выход
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="glass-card rounded-xl p-4 hover-lift animate-fade-in">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-5 w-5 text-gray-600" />
              <p className="text-sm text-gray-600">Пользователей</p>
            </div>
            <h3 className="text-2xl font-bold gradient-text">{stats?.total_users || 0}</h3>
          </div>
          <div className="glass-card rounded-xl p-4 hover-lift animate-fade-in">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-5 w-5 text-gray-600" />
              <p className="text-sm text-gray-600">Трейдеров</p>
            </div>
            <h3 className="text-2xl font-bold gradient-text">{stats?.total_traders || 0}</h3>
          </div>
          <div className="glass-card rounded-xl p-4 hover-lift animate-fade-in">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-5 w-5 text-gray-600" />
              <p className="text-sm text-gray-600">Всего транзакций</p>
            </div>
            <h3 className="text-2xl font-bold gradient-text">{stats?.total_transactions || 0}</h3>
          </div>
          <div className="glass-card rounded-xl p-4 hover-lift animate-fade-in">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-5 w-5 text-gray-600" />
              <p className="text-sm text-gray-600">Завершено</p>
            </div>
            <h3 className="text-2xl font-bold gradient-text">{stats?.completed_transactions || 0}</h3>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pending" className="glass-card rounded-2xl p-6 animate-fade-in">
          <TabsList className="grid w-full grid-cols-6 glass-card mb-6">
            <TabsTrigger value="pending" className="relative">
              Ожидают
              {pendingUsers.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {pendingUsers.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="relative">
              Вывод средств
              {withdrawals.filter(w => w.status === 'pending').length > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {withdrawals.filter(w => w.status === 'pending').length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="users">Пользователи</TabsTrigger>
            <TabsTrigger value="traders">Трейдеры</TabsTrigger>
            <TabsTrigger value="transactions">Транзакции</TabsTrigger>
            <TabsTrigger value="settings">Настройки</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <h3 className="text-xl font-semibold mb-4">Ожидают подтверждения</h3>
            <div className="space-y-2">
              {pendingUsers.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Нет ожидающих регистраций</p>
              ) : (
                pendingUsers.map((u) => (
                  <div key={u.id} className="glass-card rounded-lg p-4 hover-lift flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold">{u.email}</p>
                      <p className="text-sm text-gray-600">
                        Зарегистрирован: {new Date(u.created_at).toLocaleString('ru-RU')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => approveUser(u.id)}
                        className="bg-green-600 text-white hover:bg-green-700"
                      >
                        Одобрить
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectUser(u.id)}
                        className="border-red-600 text-red-600 hover:bg-red-50"
                      >
                        Отклонить
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="withdrawals">
            <h3 className="text-xl font-semibold mb-4">Заявки на вывод средств</h3>
            <div className="space-y-3">
              {withdrawals.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Нет заявок на вывод</p>
              ) : (
                withdrawals.map((withdrawal) => (
                  <div key={withdrawal.id} className="glass-card-dark p-4 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-semibold text-lg">{withdrawal.amount.toFixed(2)} USDT</p>
                          <span className={`px-3 py-1 rounded text-xs ${
                            withdrawal.status === 'approved' ? 'bg-green-600 text-white' :
                            withdrawal.status === 'rejected' ? 'bg-red-600 text-white' :
                            'bg-orange-500 text-white'
                          }`}>
                            {withdrawal.status === 'approved' ? 'Одобрено' :
                             withdrawal.status === 'rejected' ? 'Отклонено' :
                             'Ожидает'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">Пользователь: {withdrawal.user_email}</p>
                        <p className="text-sm text-gray-400 mb-1">Адрес: {withdrawal.wallet_address}</p>
                        <p className="text-sm text-gray-500">{new Date(withdrawal.created_at).toLocaleString('ru-RU')}</p>
                      </div>
                      {withdrawal.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => approveWithdrawal(withdrawal.id)}
                            className="bg-green-600 text-white hover:bg-green-700"
                          >
                            Одобрить
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rejectWithdrawal(withdrawal.id)}
                            className="border-red-600 text-red-600 hover:bg-red-50"
                          >
                            Отклонить
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="users">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Все пользователи</h3>
              <Button onClick={() => setShowAddUser(true)} className="bg-black text-white btn-glass">
                <Plus className="mr-2 h-4 w-4" />
                Добавить
              </Button>
            </div>
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="glass-card rounded-lg p-4 hover-lift flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold">{u.email}</p>
                    <p className="text-sm text-gray-600">Роль: {u.role}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={u.is_blocked ? "default" : "outline"}
                    onClick={() => blockUser(u.id)}
                    className={u.is_blocked ? "bg-red-600 text-white" : ""}
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    {u.is_blocked ? 'Разблокировать' : 'Заблокировать'}
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="traders">
            <h3 className="text-xl font-semibold mb-4">Все трейдеры</h3>
            <div className="space-y-2">
              {traders.map((t) => (
                <div key={t.id} className="glass-card rounded-lg p-4 hover-lift">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-semibold">{t.name} (@{t.nickname})</p>
                      <p className="text-sm text-gray-600">{t.email}</p>
                      <p className="text-sm text-gray-600">Баланс: {(t.usdt_balance || 0).toFixed(2)} USDT</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedTrader(t);
                          setShowAddBalance(true);
                        }}
                      >
                        Пополнить
                      </Button>
                      <Button
                        size="sm"
                        variant={t.is_blocked ? "default" : "outline"}
                        onClick={() => blockTrader(t.id)}
                        className={t.is_blocked ? "bg-red-600 text-white" : ""}
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="transactions">
            <h3 className="text-xl font-semibold mb-4">Все транзакции</h3>
            <div className="space-y-2">
              {transactions.slice(0, 20).map((tx) => (
                <div key={tx.id} className="glass-card rounded-lg p-4 hover-lift">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold">{(tx.amount || 0).toFixed(2)} UAH</p>
                      <p className="text-sm text-gray-600">
                        {tx.usdt_amount ? `${tx.usdt_amount.toFixed(2)} USDT` : 'Ожидание'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(tx.created_at).toLocaleString('ru-RU')}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded text-sm ${
                      tx.status === 'completed' ? 'bg-green-100 text-green-700' :
                      tx.status === 'user_confirmed' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {tx.status === 'completed' ? 'Завершено' :
                       tx.status === 'user_confirmed' ? 'Ожидание трейдера' :
                       'Ожидание клиента'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <h3 className="text-xl font-semibold mb-4">Настройки системы</h3>
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Комиссия (%)</label>
                <Input
                  type="number"
                  value={settings.commission_rate}
                  onChange={(e) => setSettings({ ...settings, commission_rate: parseFloat(e.target.value) })}
                  className="glass-card"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Курс USDT/UAH</label>
                <Input
                  type="number"
                  value={settings.usd_to_uah_rate}
                  onChange={(e) => setSettings({ ...settings, usd_to_uah_rate: parseFloat(e.target.value) })}
                  className="glass-card"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Адрес депозитного кошелька (TRC-20)</label>
                <Input
                  value={settings.deposit_wallet_address}
                  onChange={(e) => setSettings({ ...settings, deposit_wallet_address: e.target.value })}
                  className="glass-card"
                />
              </div>
              <Button onClick={updateSettings} className="bg-black text-white btn-glass">
                <Settings className="mr-2 h-4 w-4" />
                Сохранить настройки
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add User Dialog */}
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent className="glass-card max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl gradient-text">Создать пользователя</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              className="glass-card"
            />
            <Input
              type="password"
              placeholder="Пароль"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              className="glass-card"
            />
            <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
              <SelectTrigger className="glass-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="trader">Trader</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={createUser} className="w-full bg-black text-white btn-glass">
              Создать
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Balance Dialog */}
      <Dialog open={showAddBalance} onOpenChange={setShowAddBalance}>
        <DialogContent className="glass-card max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl gradient-text">
              Пополнить баланс {selectedTrader?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Текущий баланс: {(selectedTrader?.usdt_balance || 0).toFixed(2)} USDT
            </p>
            <Input
              type="number"
              placeholder="Сумма USDT"
              value={balanceAmount}
              onChange={(e) => setBalanceAmount(e.target.value)}
              className="glass-card"
            />
            <Button onClick={addBalance} className="w-full bg-black text-white btn-glass">
              Пополнить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
