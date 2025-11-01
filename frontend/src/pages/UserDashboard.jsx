import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Wallet, ArrowRight, Clock, CheckCircle, Copy, LogOut, TrendingUp, XCircle } from 'lucide-react';
import SkiPayLogo from '../components/SkiPayLogo';
import ThemeToggle from '../components/ThemeToggle';

const UserDashboard = () => {
  const { user, token, logout, API_URL } = useContext(AuthContext);
  const [amount, setAmount] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [cardDetails, setCardDetails] = useState(null);
  const [showCardDialog, setShowCardDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalAddress, setWithdrawalAddress] = useState('');
  const [withdrawals, setWithdrawals] = useState([]);

  useEffect(() => {
    fetchTransactions();
    fetchStats();
    fetchWithdrawals();
    
    // Автообновление данных каждые 5 секунд
    const interval = setInterval(() => {
      fetchTransactions();
      fetchStats();
      fetchWithdrawals();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchTransactions = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/user/transactions`, {
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

  const fetchWithdrawals = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/user/withdrawals`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWithdrawals(res.data);
    } catch (error) {
      console.error('Ошибка загрузки заявок на вывод');
    }
  };

  const calculateUSDTBalance = () => {
    const earned = transactions
      .filter(tx => tx.status === 'completed')
      .reduce((sum, tx) => sum + (tx.usdt_amount || 0), 0);
    
    const withdrawn = withdrawals
      .filter(w => w.status === 'approved')
      .reduce((sum, w) => sum + (w.amount || 0), 0);
    
    const pending = withdrawals
      .filter(w => w.status === 'pending')
      .reduce((sum, w) => sum + (w.amount || 0), 0);
    
    return { total: earned, withdrawn, pending, available: earned - withdrawn - pending };
  };
  
  const createWithdrawal = async () => {
    if (!withdrawalAmount || parseFloat(withdrawalAmount) <= 0) {
      toast.error('Введите корректную сумму');
      return;
    }
    
    if (!withdrawalAddress || withdrawalAddress.trim().length < 10) {
      toast.error('Введите корректный TRC-20 адрес');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/user/withdrawal-request`,
        { 
          amount: parseFloat(withdrawalAmount),
          wallet_address: withdrawalAddress.trim()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Заявка на вывод создана! Ожидайте одобрения администратора');
      setWithdrawalAmount('');
      setWithdrawalAddress('');
      setShowWithdrawalDialog(false);
      fetchWithdrawals();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка создания заявки');
    } finally {
      setLoading(false);
    }
  };

  const requestCard = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Введите корректную сумму');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/user/request-card`,
        { amount: parseFloat(amount), currency: 'UAH' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCardDetails(res.data);
      setShowCardDialog(true);
      setAmount('');
      toast.success('Карта получена!');
      fetchTransactions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка получения карты');
    } finally {
      setLoading(false);
    }
  };

  const confirmPayment = async (txId) => {
    try {
      await axios.post(
        `${API_URL}/api/user/confirm-payment/${txId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Платёж подтверждён! Ожидайте подтверждения от трейдера');
      fetchTransactions();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка подтверждения');
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Скопировано!');
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast.success('Скопировано!');
      } catch (err) {
        toast.error('Не удалось скопировать');
      }
      document.body.removeChild(textArea);
    }
  };

  const balanceInfo = calculateUSDTBalance();

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="glass-card rounded-2xl p-6 mb-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <SkiPayLogo size="large" className="mb-1" />
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

        {/* Balance Card */}
        <div className="glass-card rounded-2xl p-8 mb-6 hover-lift animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-black text-white rounded-full">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Доступно для вывода</p>
                <h2 className="text-4xl font-bold gradient-text">{balanceInfo.available.toFixed(2)}</h2>
              </div>
            </div>
            <Button 
              onClick={() => setShowWithdrawalDialog(true)}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 btn-glass"
              disabled={balanceInfo.available <= 0}
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              Вывод средств
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Всего получено</p>
              <p className="font-semibold">{balanceInfo.total.toFixed(2)} USDT</p>
            </div>
            <div>
              <p className="text-gray-500">Выведено</p>
              <p className="font-semibold">{balanceInfo.withdrawn.toFixed(2)} USDT</p>
            </div>
            <div>
              <p className="text-gray-500">В обработке</p>
              <p className="font-semibold">{balanceInfo.pending.toFixed(2)} USDT</p>
            </div>
          </div>
        </div>

        {/* Request Card */}
        <div className="glass-card rounded-2xl p-6 mb-6 hover-lift animate-fade-in">
          <h3 className="text-xl font-semibold mb-4">Пополнить баланс</h3>
          <p className="text-sm text-gray-600 mb-3">
            Введите желаемую сумму пополнения. Комиссия 9% будет добавлена к оплате.
          </p>
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                type="number"
                placeholder="Желаемая сумма пополнения (UAH)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="glass-card"
              />
              {amount && parseFloat(amount) > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  К оплате: {(parseFloat(amount) * 1.09).toFixed(2)} UAH (включая комиссию 9%)
                </p>
              )}
            </div>
            <Button
              onClick={requestCard}
              disabled={loading}
              className="bg-black text-white hover:bg-gray-800 btn-glass"
            >
              {loading ? 'Загрузка...' : 'Получить карту'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Transactions */}
        <div className="glass-card rounded-2xl p-6 animate-fade-in">
          <h3 className="text-xl font-semibold mb-4">История транзакций</h3>
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Нет транзакций</p>
            ) : (
              transactions.map((tx) => (
                <div key={tx.id} className="glass-card rounded-xl p-4 hover-lift">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {tx.status === 'completed' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-600" />
                        )}
                        <span className="font-semibold">
                          {tx.usdt_amount ? `${tx.usdt_amount.toFixed(2)} USDT` : 'Ожидание'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{tx.amount.toFixed(2)} UAH</p>
                      <p className="text-xs text-gray-500">
                        {new Date(tx.created_at).toLocaleString('ru-RU')}
                      </p>
                    </div>
                    <div className="text-right">
                      {tx.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => confirmPayment(tx.id)}
                          className="bg-black text-white btn-glass"
                        >
                          Подтвердить
                        </Button>
                      )}
                      {tx.status === 'user_confirmed' && (
                        <span className="text-sm text-yellow-600">Ожидание трейдера</span>
                      )}
                      {tx.status === 'completed' && (
                        <span className="text-sm text-green-600">Завершено</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Card Details Dialog */}
      <Dialog open={showCardDialog} onOpenChange={setShowCardDialog}>
        <DialogContent className="glass-card max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl gradient-text">Реквизиты для оплаты</DialogTitle>
          </DialogHeader>
          {cardDetails && (
            <div className="space-y-4">
              {cardDetails.card.card_name && (
                <div className="glass-card p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Название карты</p>
                  <p className="font-semibold">{cardDetails.card.card_name}</p>
                </div>
              )}
              <div className="glass-card p-3 rounded-lg">
                <p className="text-sm text-gray-600">Банк</p>
                <p className="font-semibold">{cardDetails.card.bank_name}</p>
              </div>
              <div className="glass-card p-3 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Номер карты</p>
                  <p className="font-semibold">{cardDetails.card.card_number}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(cardDetails.card.card_number)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="glass-card p-3 rounded-lg">
                <p className="text-sm text-gray-600">Получатель</p>
                <p className="font-semibold">{cardDetails.card.holder_name}</p>
              </div>
              <div className="glass-card p-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                <p className="text-sm opacity-90">💳 ПЕРЕВЕДИТЕ НА КАРТУ</p>
                <p className="text-3xl font-bold mt-1">{cardDetails.card.amount_to_pay} {cardDetails.card.currency}</p>
                <div className="mt-3 space-y-1 text-xs opacity-80 bg-black/20 p-2 rounded">
                  <p>📊 Сумма пополнения: {cardDetails.card.amount} UAH</p>
                  <p>💰 Комиссия {cardDetails.card.commission_rate}%: +{cardDetails.card.commission_amount} UAH</p>
                  <p>💱 Курс: 1 USDT = {cardDetails.card.exchange_rate} UAH</p>
                </div>
              </div>
              <div className="glass-card p-3 rounded-lg">
                <p className="text-sm text-gray-600">Вы получите</p>
                <p className="text-xl font-bold gradient-text">{cardDetails.card.usdt_amount} USDT</p>
              </div>
              <Button
                onClick={() => {
                  confirmPayment(cardDetails.transaction_id);
                  setShowCardDialog(false);
                }}
                className="w-full bg-black text-white btn-glass"
              >
                Я оплатил(а)
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Withdrawal Dialog */}
      <Dialog open={showWithdrawalDialog} onOpenChange={setShowWithdrawalDialog}>
        <DialogContent className="glass-card max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl gradient-text">Вывод средств</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">Доступно для вывода</p>
              <p className="text-3xl font-bold gradient-text">{balanceInfo.available.toFixed(2)} USDT</p>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-2 block">Сумма для вывода (USDT)</label>
              <Input
                type="number"
                placeholder="Введите сумму"
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value)}
                className="glass-card"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-2 block">Ваш TRC-20 адрес кошелька</label>
              <Input
                type="text"
                placeholder="Введите адрес TRC-20"
                value={withdrawalAddress}
                onChange={(e) => setWithdrawalAddress(e.target.value)}
                className="glass-card"
              />
            </div>
            <Button
              onClick={createWithdrawal}
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white btn-glass"
            >
              {loading ? 'Создание...' : 'Создать заявку на вывод'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Withdrawals Section */}
      {withdrawals.length > 0 && (
        <div className="glass-card rounded-2xl p-6 mb-6 hover-lift animate-fade-in">
          <h3 className="text-xl font-semibold mb-4">Мои заявки на вывод</h3>
          <div className="space-y-3">
            {withdrawals.map((withdrawal) => (
              <div key={withdrawal.id} className="glass-card-dark p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-lg">{withdrawal.amount.toFixed(2)} USDT</p>
                    <p className="text-sm text-gray-500">{new Date(withdrawal.created_at).toLocaleString('ru-RU')}</p>
                  </div>
                  <span className={`px-3 py-1 rounded text-sm ${
                    withdrawal.status === 'approved' ? 'bg-green-600 text-white' :
                    withdrawal.status === 'rejected' ? 'bg-red-600 text-white' :
                    'bg-yellow-600 text-white'
                  }`}>
                    {withdrawal.status === 'approved' ? 'Одобрено' :
                     withdrawal.status === 'rejected' ? 'Отклонено' :
                     'В обработке'}
                  </span>
                </div>
                <p className="text-sm text-gray-400 truncate">Адрес: {withdrawal.wallet_address}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;