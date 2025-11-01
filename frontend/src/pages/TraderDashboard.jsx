import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Wallet, Plus, Clock, CheckCircle, TrendingUp, LogOut, Edit, Trash2 } from 'lucide-react';
import SkiPayLogo from '../components/SkiPayLogo';
import ThemeToggle from '../components/ThemeToggle';

const TraderDashboard = () => {
  const { user, token, logout, API_URL } = useContext(AuthContext);
  const [cards, setCards] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [depositWallet, setDepositWallet] = useState('');
  const [showAddCard, setShowAddCard] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [isWorking, setIsWorking] = useState(false);
  const [cardForm, setCardForm] = useState({
    card_number: '',
    bank_name: '',
    holder_name: '',
    limit: '',
    currency: 'UAH',
    card_name: ''
  });

  useEffect(() => {
    fetchCards();
    fetchTransactions();
    fetchStats();
    fetchDepositWallet();
    fetchTraderInfo();
    
    // Автообновление данных каждые 5 секунд
    const interval = setInterval(() => {
      fetchTransactions();
      fetchStats();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchCards = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/trader/cards`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCards(res.data);
    } catch (error) {
      toast.error('Ошибка загрузки карт');
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/trader/transactions`, {
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

  const fetchTraderInfo = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/trader/info`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsWorking(res.data.is_working);
    } catch (error) {
      console.error('Ошибка загрузки информации о трейдере');
    }
  };

  const toggleWork = async () => {
    try {
      const res = await axios.post(
        `${API_URL}/api/trader/toggle-work`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsWorking(res.data.is_working);
      toast.success(res.data.message);
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка переключения статуса');
    }
  };

  const fetchDepositWallet = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/settings/public`);
      setDepositWallet(res.data.deposit_wallet_address);
    } catch (error) {
      console.error('Ошибка загрузки адреса кошелька');
    }
  };

  const addCard = async () => {
    if (!cardForm.card_number || !cardForm.bank_name || !cardForm.holder_name || !cardForm.limit) {
      toast.error('Заполните все поля');
      return;
    }

    try {
      await axios.post(
        `${API_URL}/api/trader/cards`,
        { ...cardForm, limit: parseFloat(cardForm.limit) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Карта добавлена!');
      setShowAddCard(false);
      setCardForm({ card_number: '', bank_name: '', holder_name: '', limit: '', currency: 'UAH', card_name: '' });
      fetchCards();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка добавления карты');
    }
  };

  const updateCard = async () => {
    try {
      const updateData = {};
      if (editingCard.limit) updateData.limit = parseFloat(editingCard.limit);
      if (editingCard.status) updateData.status = editingCard.status;
      if (editingCard.card_name !== undefined) updateData.card_name = editingCard.card_name;

      await axios.put(
        `${API_URL}/api/trader/cards/${editingCard.id}`,
        updateData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Карта обновлена!');
      setEditingCard(null);
      fetchCards();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка обновления карты');
    }
  };

  const deleteCard = async (cardId) => {
    if (!window.confirm('Удалить карту?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/trader/cards/${cardId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Карта удалена');
      fetchCards();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка удаления карты');
    }
  };

  const confirmPayment = async (txId) => {
    try {
      const res = await axios.post(
        `${API_URL}/api/trader/confirm-payment/${txId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Подтверждено! ${res.data.usdt_sent_to_user} USDT отправлено клиенту`);
      fetchTransactions();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка подтверждения');
    }
  };

  const pendingTransactions = transactions.filter(tx => tx.status === 'user_confirmed');
  const completedTransactions = transactions.filter(tx => tx.status === 'completed');

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="glass-card rounded-2xl p-6 mb-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <SkiPayLogo size="large" />
                  <span className="text-2xl font-bold gradient-text">Trader</span>
                </div>
                <p className="text-gray-600 mt-1">{user.email}</p>
              </div>
              <Button
                onClick={toggleWork}
                className={`btn-glass ${isWorking ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-600 hover:bg-gray-700 text-white'}`}
              >
                {isWorking ? '🟢 В работе' : '⚫ Не работаю'}
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Button variant="outline" onClick={logout} className="glass-card">
                <LogOut className="mr-2 h-4 w-4" />
                Выход
              </Button>
            </div>
          </div>
          {!isWorking && stats && stats.balance < 50 && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                ⚠️ Недостаточно средств для работы. Минимальный баланс: 50 USDT. Текущий баланс: {stats.balance.toFixed(2)} USDT
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="glass-card rounded-2xl p-4 hover-lift animate-fade-in">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 bg-black text-white rounded-full">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-gray-600">USDT Баланс</p>
                <h3 className="text-xl font-bold gradient-text">
                  {stats ? stats.balance.toFixed(2) : '0.00'}
                </h3>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4 hover-lift animate-fade-in">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 bg-green-600 text-white rounded-full">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Заработок сегодня</p>
                <h3 className="text-xl font-bold text-green-600">
                  {stats ? stats.today_profit.toFixed(2) : '0.00'} UAH
                </h3>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4 hover-lift animate-fade-in">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 bg-blue-600 text-white rounded-full">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Всего заработано</p>
                <h3 className="text-xl font-bold text-blue-600">
                  {stats ? stats.total_profit.toFixed(2) : '0.00'} UAH
                </h3>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4 hover-lift animate-fade-in">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 bg-yellow-600 text-white rounded-full">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Ожидают</p>
                <h3 className="text-xl font-bold text-yellow-600">
                  {stats ? stats.pending_transactions : 0}
                </h3>
              </div>
            </div>
          </div>
        </div>

        {depositWallet && (
          <div className="glass-card rounded-2xl p-6 mb-6 hover-lift animate-fade-in">
            <p className="text-sm text-gray-400 mb-2">Адрес для пополнения USDT (TRC-20)</p>
            <div className="flex items-center gap-2">
              <code className="wallet-address-field text-sm font-mono px-3 py-2 rounded flex-1">
                {depositWallet}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(depositWallet);
                    toast.success('Адрес скопирован!');
                  } catch (error) {
                    // Fallback
                    const textArea = document.createElement('textarea');
                    textArea.value = depositWallet;
                    document.body.appendChild(textArea);
                    textArea.select();
                    try {
                      document.execCommand('copy');
                      toast.success('Адрес скопирован!');
                    } catch (err) {
                      toast.error('Не удалось скопировать');
                    }
                    document.body.removeChild(textArea);
                  }
                }}
                className="border-purple-500/30 btn-primary"
              >
                Копировать
              </Button>
            </div>
          </div>
        )}

        <div className="glass-card rounded-2xl p-6 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-semibold">Мои карты</h3>
              <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">{cards.length}</span>
            </div>
            <Button onClick={() => setShowAddCard(true)} className="bg-black text-white btn-glass">
              <Plus className="mr-2 h-4 w-4" />
              Добавить карту
            </Button>
          </div>

          <div className="max-h-[450px] overflow-y-auto space-y-2 pr-2">
            {cards.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Нет карт</p>
            ) : (
              cards.map((card) => (
                <div key={card.id} className="glass-card rounded-lg p-3 hover-lift transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {card.card_name && (
                          <p className="font-semibold text-sm text-gray-200">{card.card_name}</p>
                        )}
                        <div className={`w-3 h-3 rounded-full ${card.status === 'active' ? 'bg-green-500' : 'bg-gray-500'} shadow-lg ${card.status === 'active' ? 'shadow-green-500/50' : ''}`}></div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                        <span>{card.bank_name}</span>
                        <span>•</span>
                        <span className="font-mono">{card.card_number}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {card.current_usage.toFixed(0)} / {card.limit.toFixed(0)} UAH
                        </span>
                        <div className="flex-1 bg-gray-800/50 rounded-full h-1.5 min-w-[80px]">
                          <div 
                            className="h-1.5 rounded-full transition-all" 
                            style={{
                              width: `${Math.min((card.current_usage / card.limit) * 100, 100)}%`,
                              background: 'linear-gradient(90deg, #6b7280 0%, #9ca3af 100%)'
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingCard({ ...card })}
                        className="h-7 w-7 p-0 border-purple-500/30"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteCard(card.id)}
                        className="h-7 w-7 p-0 border-purple-500/30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {pendingTransactions.length > 0 && (
          <div className="glass-card rounded-2xl p-6 mb-6 animate-fade-in">
            <h3 className="text-xl font-semibold mb-4">Ожидают подтверждения</h3>
            <div className="space-y-3">
              {pendingTransactions.map((tx) => (
                <div key={tx.id} className="glass-card rounded-xl p-4 hover-lift">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-5 w-5 text-yellow-600" />
                        <span className="font-semibold">{tx.amount.toFixed(2)} UAH</span>
                      </div>
                      {tx.card && (
                        <p className="text-sm text-gray-600">
                          {tx.card.card_name || tx.card.bank_name} - {tx.card.card_number}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        {new Date(tx.created_at).toLocaleString('ru-RU')}
                      </p>
                      {tx.usdt_requested && (
                        <p className="text-xs text-gray-500 mt-1">
                          Клиент получит: {tx.usdt_requested.toFixed(2)} USDT
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={() => confirmPayment(tx.id)}
                      className="bg-black text-white btn-glass"
                    >
                      Подтвердить
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="glass-card rounded-2xl p-6 animate-fade-in">
          <h3 className="text-xl font-semibold mb-4">Завершённые транзакции</h3>
          <div className="space-y-3">
            {completedTransactions.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Нет завершённых транзакций</p>
            ) : (
              completedTransactions.slice(0, 10).map((tx) => (
                <div key={tx.id} className="glass-card rounded-xl p-4 hover-lift">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="font-semibold">{tx.amount.toFixed(2)} UAH</span>
                      </div>
                      {tx.card && (
                        <p className="text-sm text-gray-600">
                          {tx.card.card_name || tx.card.bank_name} - {tx.card.card_number}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        {new Date(tx.completed_at).toLocaleString('ru-RU')}
                      </p>
                      {tx.usdt_amount && (
                        <p className="text-xs text-green-600 mt-1">
                          Отправлено: {tx.usdt_amount.toFixed(2)} USDT
                        </p>
                      )}
                    </div>
                    <span className="text-sm text-green-600">Завершено</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Dialog open={showAddCard} onOpenChange={setShowAddCard}>
        <DialogContent className="glass-card max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl gradient-text">Добавить карту</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Название карты (необязательно)"
              value={cardForm.card_name}
              onChange={(e) => setCardForm({ ...cardForm, card_name: e.target.value })}
              className="glass-card"
            />
            <Input
              placeholder="Номер карты"
              value={cardForm.card_number}
              onChange={(e) => setCardForm({ ...cardForm, card_number: e.target.value })}
              className="glass-card"
            />
            <Input
              placeholder="Банк"
              value={cardForm.bank_name}
              onChange={(e) => setCardForm({ ...cardForm, bank_name: e.target.value })}
              className="glass-card"
            />
            <Input
              placeholder="Владелец"
              value={cardForm.holder_name}
              onChange={(e) => setCardForm({ ...cardForm, holder_name: e.target.value })}
              className="glass-card"
            />
            <Input
              type="number"
              placeholder="Лимит"
              value={cardForm.limit}
              onChange={(e) => setCardForm({ ...cardForm, limit: e.target.value })}
              className="glass-card"
            />
            <Button onClick={addCard} className="w-full bg-black text-white btn-glass">
              Добавить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCard} onOpenChange={() => setEditingCard(null)}>
        <DialogContent className="glass-card max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl gradient-text">Редактировать карту</DialogTitle>
          </DialogHeader>
          {editingCard && (
            <div className="space-y-4">
              <Input
                placeholder="Название карты"
                value={editingCard.card_name || ''}
                onChange={(e) => setEditingCard({ ...editingCard, card_name: e.target.value })}
                className="glass-card"
              />
              <Input
                type="number"
                placeholder="Лимит"
                value={editingCard.limit}
                onChange={(e) => setEditingCard({ ...editingCard, limit: e.target.value })}
                className="glass-card"
              />
              <Select
                value={editingCard.status}
                onValueChange={(value) => setEditingCard({ ...editingCard, status: value })}
              >
                <SelectTrigger className="glass-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Активна</SelectItem>
                  <SelectItem value="paused">Пауза</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={updateCard} className="w-full bg-black text-white btn-glass">
                Сохранить
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TraderDashboard;