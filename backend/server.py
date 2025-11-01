from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

security = HTTPBearer()

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ===== MODELS =====
class UserRegister(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    password_hash: str
    role: str = "user"  # user, trader, admin
    is_blocked: bool = False
    is_approved: bool = False  # Requires admin approval
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class TraderRegister(BaseModel):
    name: str
    nickname: str
    usdt_address: str
    phone: str

class Trader(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    nickname: str
    usdt_address: str
    phone: str
    usdt_balance: float = 0.0
    is_blocked: bool = False
    is_working: bool = False  # Toggle work status
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CardCreate(BaseModel):
    card_number: str
    bank_name: str
    holder_name: str
    limit: float
    currency: str = "UAH"
    card_name: Optional[str] = None  # Custom name for the card

class Card(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    trader_id: str
    card_number: str
    bank_name: str
    holder_name: str
    limit: float
    current_usage: float = 0.0
    status: str = "active"  # active, paused
    currency: str = "UAH"
    card_name: Optional[str] = None  # Custom name for the card
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CardUpdate(BaseModel):
    limit: Optional[float] = None
    status: Optional[str] = None
    card_name: Optional[str] = None

class TransactionRequest(BaseModel):
    amount: float  # Amount in UAH user wants to pay
    currency: str = "UAH"  # Payment currency

class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    trader_id: str
    card_id: str
    amount: float  # Amount in UAH with commission that user pays
    usdt_requested: float = 0.0  # Amount of USDT user requested
    usdt_amount: float = 0.0  # Actual USDT amount sent to user (same as requested)
    currency: str = "UAH"
    status: str = "pending"  # pending, user_confirmed, trader_confirmed, completed, cancelled
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    user_confirmed_at: Optional[str] = None
    completed_at: Optional[str] = None
    expires_at: str = Field(default_factory=lambda: (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat())

class AdminAddBalance(BaseModel):
    amount: float

class AdminSettings(BaseModel):
    commission_rate: float  # percentage
    usd_to_uah_rate: float  # 1 USDT = X UAH
    deposit_wallet_address: str = "TB4K5h9QwFGSYR2LLJS9ejmt9EjHWurvi1"  # TRC-20 wallet for deposits

class WithdrawalRequest(BaseModel):
    amount: float
    wallet_address: str  # TRC-20 address

class Withdrawal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_email: str
    amount: float
    wallet_address: str
    status: str = "pending"  # pending, approved, rejected
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    processed_at: Optional[str] = None
    admin_note: Optional[str] = None

# ===== AUTH HELPERS =====
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        'user_id': user_id,
        'email': email,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    payload = decode_token(token)
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user

async def require_trader(user: dict = Depends(get_current_user)) -> dict:
    if user['role'] not in ['trader', 'admin']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Trader access required")
    return user

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user['role'] != 'admin':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user

# ===== AUTH ROUTES =====
@api_router.post("/auth/register")
async def register(data: UserRegister):
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    
    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        is_approved=False  # Requires admin approval
    )
    await db.users.insert_one(user.model_dump())
    
    # Don't return token - user needs approval first
    return {
        "message": "Registration successful! Your account is pending admin approval.",
        "user": {"id": user.id, "email": user.email, "status": "pending_approval"}
    }

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user['password_hash']):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    # Check if user is blocked
    if user.get('is_blocked', False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is blocked")
    
    # Check if user is approved (admins bypass this check)
    if user['role'] != 'admin' and not user.get('is_approved', False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account pending admin approval")
    
    token = create_token(user['id'], user['email'], user['role'])
    return {"token": token, "user": {"id": user['id'], "email": user['email'], "role": user['role']}}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    trader = None
    if user['role'] in ['trader', 'admin']:
        trader = await db.traders.find_one({"user_id": user['id']}, {"_id": 0})
    
    return {
        "id": user['id'],
        "email": user['email'],
        "role": user['role'],
        "trader": trader
    }

# ===== TRADER ROUTES =====
@api_router.post("/trader/register")
async def become_trader(data: TraderRegister, user: dict = Depends(get_current_user)):
    if user['role'] == 'trader':
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already a trader")
    
    existing = await db.traders.find_one({"user_id": user['id']}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Trader profile already exists")
    
    trader = Trader(
        user_id=user['id'],
        name=data.name,
        nickname=data.nickname,
        usdt_address=data.usdt_address,
        phone=data.phone
    )
    await db.traders.insert_one(trader.model_dump())
    
    # Update user role
    await db.users.update_one({"id": user['id']}, {"$set": {"role": "trader"}})
    
    return trader

@api_router.get("/trader/profile")
async def get_trader_profile(user: dict = Depends(require_trader)):
    trader = await db.traders.find_one({"user_id": user['id']}, {"_id": 0})
    if not trader:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trader profile not found")
    return trader

@api_router.post("/trader/cards")
async def add_card(data: CardCreate, user: dict = Depends(require_trader)):
    trader = await db.traders.find_one({"user_id": user['id']}, {"_id": 0})
    if not trader:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trader profile not found")
    
    card = Card(
        trader_id=trader['id'],
        card_number=data.card_number,
        bank_name=data.bank_name,
        holder_name=data.holder_name,
        limit=data.limit,
        currency=data.currency,
        card_name=data.card_name
    )
    await db.cards.insert_one(card.model_dump())
    return card

@api_router.get("/trader/cards")
async def get_trader_cards(user: dict = Depends(require_trader)):
    trader = await db.traders.find_one({"user_id": user['id']}, {"_id": 0})
    if not trader:
        return []
    
    cards = await db.cards.find({"trader_id": trader['id']}, {"_id": 0}).to_list(1000)
    return cards

@api_router.put("/trader/cards/{card_id}")
async def update_card(card_id: str, data: CardUpdate, user: dict = Depends(require_trader)):
    trader = await db.traders.find_one({"user_id": user['id']}, {"_id": 0})
    if not trader:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trader profile not found")
    
    card = await db.cards.find_one({"id": card_id, "trader_id": trader['id']}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    await db.cards.update_one({"id": card_id}, {"$set": update_data})
    
    updated_card = await db.cards.find_one({"id": card_id}, {"_id": 0})
    return updated_card

@api_router.delete("/trader/cards/{card_id}")
async def delete_card(card_id: str, user: dict = Depends(require_trader)):
    trader = await db.traders.find_one({"user_id": user['id']}, {"_id": 0})
    if not trader:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trader profile not found")
    
    result = await db.cards.delete_one({"id": card_id, "trader_id": trader['id']})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
    
    return {"message": "Card deleted successfully"}

@api_router.get("/trader/transactions")
async def get_trader_transactions(user: dict = Depends(require_trader)):
    trader = await db.traders.find_one({"user_id": user['id']}, {"_id": 0})
    if not trader:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trader profile not found")
    
    # Check for expired transactions and disable trader if needed
    now = datetime.now(timezone.utc)
    expired_txns = await db.transactions.find({
        "trader_id": trader['id'],
        "status": "user_confirmed",
        "expires_at": {"$lt": now.isoformat()}
    }, {"_id": 0}).to_list(100)
    
    if expired_txns:
        # Disable trader due to expired transactions
        await db.traders.update_one({"id": trader['id']}, {"$set": {"is_working": False}})
        
        # Mark transactions as expired
        for txn in expired_txns:
            await db.transactions.update_one(
                {"id": txn['id']},
                {"$set": {"status": "expired"}}
            )
    
    transactions = await db.transactions.find({"trader_id": trader['id']}, {"_id": 0}).to_list(1000)
    
    # Enrich with card info
    for txn in transactions:
        card = await db.cards.find_one({"id": txn['card_id']}, {"_id": 0})
        if card:
            txn['card'] = {
                "card_number": card['card_number'],
                "bank_name": card['bank_name'],
                "card_name": card.get('card_name')
            }
    
    return transactions

@api_router.get("/trader/info")
async def get_trader_info(user: dict = Depends(require_trader)):
    trader = await db.traders.find_one({"user_id": user['id']}, {"_id": 0})
    if not trader:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trader profile not found")
    
    return {
        "id": trader['id'],
        "email": trader.get('email', user['email']),
        "usdt_balance": trader.get('usdt_balance', 0.0),
        "is_working": trader.get('is_working', False),
        "is_blocked": trader.get('is_blocked', False)
    }

@api_router.post("/trader/toggle-work")
async def toggle_trader_work(user: dict = Depends(require_trader)):
    trader = await db.traders.find_one({"user_id": user['id']}, {"_id": 0})
    if not trader:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trader profile not found")
    
    # Check balance before enabling
    if not trader.get('is_working', False):  # Trying to enable
        if trader['usdt_balance'] < 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail=f"Cannot enable work mode. Minimum balance required: 50 USDT. Current balance: {trader['usdt_balance']:.2f} USDT"
            )
    
    # Toggle status
    new_status = not trader.get('is_working', False)
    await db.traders.update_one({"id": trader['id']}, {"$set": {"is_working": new_status}})
    
    return {
        "is_working": new_status,
        "message": "Work mode enabled" if new_status else "Work mode disabled"
    }

@api_router.post("/trader/confirm-payment/{transaction_id}")
async def trader_confirm_payment(transaction_id: str, user: dict = Depends(require_trader)):
    trader = await db.traders.find_one({"user_id": user['id']}, {"_id": 0})
    if not trader:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trader profile not found")
    
    txn = await db.transactions.find_one({"id": transaction_id, "trader_id": trader['id']}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    
    if txn['status'] != 'user_confirmed':
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User must confirm payment first")
    
    # Get USDT requested amount
    usdt_requested = txn.get('usdt_requested', 0.0)
    if usdt_requested <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid transaction data")
    
    # Calculate USDT to deduct from trader (4% more than requested)
    usdt_to_deduct = usdt_requested * 1.04
    
    # Check trader balance
    if trader['usdt_balance'] < usdt_to_deduct:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient USDT balance")
    
    # Update trader balance (списываем +4% у трейдера)
    new_balance = trader['usdt_balance'] - usdt_to_deduct
    
    # Auto-disable trader if balance falls below 50 USDT
    update_data = {"usdt_balance": new_balance}
    if new_balance < 50:
        update_data["is_working"] = False
    
    await db.traders.update_one({"id": trader['id']}, {"$set": update_data})
    
    # Update transaction
    await db.transactions.update_one(
        {"id": transaction_id},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "usdt_amount": usdt_requested
        }}
    )
    
    # Get settings for display
    settings = await db.settings.find_one({}, {"_id": 0})
    usd_to_uah_rate = settings['usd_to_uah_rate'] if settings else 41.5
    
    response = {
        "message": "Payment confirmed and USDT sent",
        "usdt_sent_to_user": round(usdt_requested, 2),
        "usdt_deducted_from_trader": round(usdt_to_deduct, 2),
        "uah_received": txn['amount'],
        "rate": usd_to_uah_rate
    }
    
    if new_balance < 50:
        response["warning"] = "Your balance is below 50 USDT. You have been automatically disabled from work."
    
    return response

# ===== USER ROUTES =====
@api_router.post("/user/request-card")
async def request_card(data: TransactionRequest, user: dict = Depends(get_current_user)):
    # Validate amount
    if data.amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount must be positive")
    
    # Get settings for commission
    settings = await db.settings.find_one({}, {"_id": 0})
    commission_rate = settings['commission_rate'] if settings else 9.0
    usd_to_uah_rate = settings['usd_to_uah_rate'] if settings else 41.5
    
    # NEW LOGIC: Client enters desired deposit amount (without commission)
    # data.amount = UAH клиент ХОЧЕТ положить на счет (без комиссии)
    # Клиент ПЛАТИТ: amount * (1 + commission/100) = amount * 1.09
    # Клиент ПОЛУЧАЕТ: amount / rate USDT
    
    amount_to_pay = data.amount * (1 + commission_rate / 100)  # Сумма к оплате С комиссией
    usdt_to_receive = data.amount / usd_to_uah_rate  # USDT которые получит клиент
    commission_amount = amount_to_pay - data.amount  # Комиссия в UAH
    
    # Find available cards from WORKING traders with sufficient balance
    cards = await db.cards.find({
        "status": "active",
        "currency": data.currency
    }, {"_id": 0}).to_list(1000)
    
    if not cards:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No available cards")
    
    # Filter cards by trader status and balance
    available_card = None
    for card in cards:
        # Check trader
        trader = await db.traders.find_one({"id": card['trader_id']}, {"_id": 0})
        if not trader:
            continue
        
        # Check if trader is working and has sufficient balance (at least 50 USDT + request amount)
        usdt_needed = usdt_to_receive * 1.04  # +4% for trader
        if not trader.get('is_working', False):
            continue
        if trader['usdt_balance'] < max(50, usdt_needed):
            continue
        if trader.get('is_blocked', False):
            continue
        
        # Check card limit (with commission)
        if (card['limit'] - card['current_usage']) >= amount_to_pay:
            available_card = card
            break
    
    if not available_card:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No working traders available. Please try again later.")
    
    # Create transaction
    # amount = сумма БЕЗ комиссии (желаемое пополнение)
    # amount_to_pay будет рассчитано при отображении
    txn = Transaction(
        user_id=user['id'],
        trader_id=available_card['trader_id'],
        card_id=available_card['id'],
        amount=round(data.amount, 2),  # Сумма БЕЗ комиссии
        usdt_requested=round(usdt_to_receive, 2),
        currency=data.currency
    )
    await db.transactions.insert_one(txn.model_dump())
    
    # Update card usage (используем amount_to_pay С комиссией)
    await db.cards.update_one(
        {"id": available_card['id']},
        {"$set": {"current_usage": available_card['current_usage'] + amount_to_pay}}
    )
    
    return {
        "transaction_id": txn.id,
        "card": {
            "bank_name": available_card['bank_name'],
            "card_number": available_card['card_number'],
            "holder_name": available_card['holder_name'],
            "card_name": available_card.get('card_name'),
            "amount": round(data.amount, 2),  # Сумма БЕЗ комиссии
            "amount_to_pay": round(amount_to_pay, 2),  # Сумма К ОПЛАТЕ (с комиссией)
            "currency": data.currency,
            "usdt_amount": round(usdt_to_receive, 2),
            "commission_rate": commission_rate,
            "commission_amount": round(commission_amount, 2),
            "exchange_rate": usd_to_uah_rate
        },
        "expires_at": txn.expires_at
    }

@api_router.post("/user/confirm-payment/{transaction_id}")
async def user_confirm_payment(transaction_id: str, user: dict = Depends(get_current_user)):
    txn = await db.transactions.find_one({"id": transaction_id, "user_id": user['id']}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    
    if txn['status'] != 'pending':
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transaction already processed")
    
    await db.transactions.update_one(
        {"id": transaction_id},
        {"$set": {
            "status": "user_confirmed",
            "user_confirmed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Payment confirmation sent to trader"}

@api_router.get("/user/transactions")
async def get_user_transactions(user: dict = Depends(get_current_user)):
    transactions = await db.transactions.find({"user_id": user['id']}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return transactions

# ===== WITHDRAWAL ROUTES =====
@api_router.post("/user/withdrawal-request")
async def create_withdrawal_request(data: WithdrawalRequest, user: dict = Depends(get_current_user)):
    # Check user balance
    user_transactions = await db.transactions.find({
        "user_id": user['id'],
        "status": "completed"
    }, {"_id": 0}).to_list(1000)
    
    total_usdt = sum(tx.get('usdt_amount', 0) for tx in user_transactions)
    
    # Check pending withdrawals
    pending_withdrawals = await db.withdrawals.find({
        "user_id": user['id'],
        "status": "pending"
    }, {"_id": 0}).to_list(1000)
    
    pending_amount = sum(w.get('amount', 0) for w in pending_withdrawals)
    
    # Check approved withdrawals
    approved_withdrawals = await db.withdrawals.find({
        "user_id": user['id'],
        "status": "approved"
    }, {"_id": 0}).to_list(1000)
    
    approved_amount = sum(w.get('amount', 0) for w in approved_withdrawals)
    
    available_balance = total_usdt - pending_amount - approved_amount
    
    if data.amount > available_balance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient balance. Available: {available_balance:.2f} USDT"
        )
    
    if data.amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount must be positive")
    
    # Create withdrawal request
    withdrawal = Withdrawal(
        user_id=user['id'],
        user_email=user['email'],
        amount=data.amount,
        wallet_address=data.wallet_address,
        status="pending"
    )
    
    await db.withdrawals.insert_one(withdrawal.model_dump())
    
    return {"message": "Withdrawal request created", "withdrawal_id": withdrawal.id}

@api_router.get("/user/withdrawals")
async def get_user_withdrawals(user: dict = Depends(get_current_user)):
    withdrawals = await db.withdrawals.find({"user_id": user['id']}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return withdrawals

# ===== ADMIN ROUTES =====
@api_router.get("/admin/traders")
async def get_all_traders(user: dict = Depends(require_admin)):
    traders = await db.traders.find({}, {"_id": 0}).to_list(1000)
    
    # Enrich with user email
    for trader in traders:
        user_doc = await db.users.find_one({"id": trader['user_id']}, {"_id": 0})
        trader['email'] = user_doc['email'] if user_doc else None
    
    return traders

@api_router.get("/admin/users")
async def get_all_users(user: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = "user"  # user, trader, admin

@api_router.post("/admin/users/create")
async def admin_create_user(data: UserCreate, admin: dict = Depends(require_admin)):
    # Check if user already exists
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")
    
    # Validate role
    if data.role not in ["user", "trader", "admin"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")
    
    # Create user (auto-approved when created by admin)
    new_user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        role=data.role,
        is_approved=True  # Admin-created users are auto-approved
    )
    await db.users.insert_one(new_user.model_dump())
    
    return {
        "message": "User created successfully",
        "user": {
            "id": new_user.id,
            "email": new_user.email,
            "role": new_user.role,
            "password": data.password  # Return password for admin to give to user
        }
    }

@api_router.put("/admin/users/{user_id}/block")
async def admin_block_user(user_id: str, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Toggle is_blocked field
    current_blocked = user.get('is_blocked', False)
    new_status = not current_blocked
    await db.users.update_one({"id": user_id}, {"$set": {"is_blocked": new_status}})
    
    return {"message": "User status updated", "is_blocked": new_status}

@api_router.put("/admin/users/{user_id}/approve")
async def admin_approve_user(user_id: str, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    await db.users.update_one({"id": user_id}, {"$set": {"is_approved": True}})
    
    return {"message": "User approved", "is_approved": True}

@api_router.delete("/admin/users/{user_id}/reject")
async def admin_reject_user(user_id: str, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Delete the user if not approved yet
    if not user.get('is_approved', False):
        await db.users.delete_one({"id": user_id})
        return {"message": "User registration rejected and deleted"}
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot reject approved user")

@api_router.get("/admin/users/pending")
async def get_pending_users(admin: dict = Depends(require_admin)):
    pending_users = await db.users.find({"is_approved": False, "role": {"$ne": "admin"}}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return pending_users

@api_router.post("/admin/traders/{trader_id}/add-balance")
async def admin_add_balance(trader_id: str, data: AdminAddBalance, user: dict = Depends(require_admin)):
    trader = await db.traders.find_one({"id": trader_id}, {"_id": 0})
    if not trader:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trader not found")
    
    new_balance = trader['usdt_balance'] + data.amount
    await db.traders.update_one({"id": trader_id}, {"$set": {"usdt_balance": new_balance}})
    
    return {"message": "Balance added", "new_balance": new_balance}

@api_router.put("/admin/traders/{trader_id}/block")
async def admin_block_trader(trader_id: str, user: dict = Depends(require_admin)):
    trader = await db.traders.find_one({"id": trader_id}, {"_id": 0})
    if not trader:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trader not found")
    
    new_status = not trader['is_blocked']
    await db.traders.update_one({"id": trader_id}, {"$set": {"is_blocked": new_status}})
    
    return {"message": "Trader status updated", "is_blocked": new_status}

@api_router.get("/admin/transactions")
async def get_all_transactions(user: dict = Depends(require_admin)):
    transactions = await db.transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return transactions

@api_router.get("/admin/settings")
async def get_settings(user: dict = Depends(require_admin)):
    settings = await db.settings.find_one({}, {"_id": 0})
    if not settings:
        settings = {
            "commission_rate": 9.0,
            "usd_to_uah_rate": 41.5,
            "deposit_wallet_address": "TB4K5h9QwFGSYR2LLJS9ejmt9EjHWurvi1"
        }
        await db.settings.insert_one(settings)
    return settings

@api_router.get("/settings/public")
async def get_public_settings():
    """Public endpoint for deposit wallet address"""
    settings = await db.settings.find_one({}, {"_id": 0})
    if not settings:
        return {"deposit_wallet_address": "TB4K5h9QwFGSYR2LLJS9ejmt9EjHWurvi1"}
    return {"deposit_wallet_address": settings.get("deposit_wallet_address", "TB4K5h9QwFGSYR2LLJS9ejmt9EjHWurvi1")}

@api_router.put("/admin/settings")
async def update_settings(data: AdminSettings, user: dict = Depends(require_admin)):
    await db.settings.update_one({}, {"$set": data.model_dump()}, upsert=True)
    return {"message": "Settings updated"}

@api_router.get("/admin/withdrawals")
async def get_all_withdrawals(user: dict = Depends(require_admin)):
    withdrawals = await db.withdrawals.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return withdrawals

@api_router.put("/admin/withdrawals/{withdrawal_id}/approve")
async def approve_withdrawal(withdrawal_id: str, user: dict = Depends(require_admin)):
    withdrawal = await db.withdrawals.find_one({"id": withdrawal_id}, {"_id": 0})
    if not withdrawal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Withdrawal not found")
    
    if withdrawal['status'] != 'pending':
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Withdrawal already processed")
    
    await db.withdrawals.update_one(
        {"id": withdrawal_id},
        {"$set": {
            "status": "approved",
            "processed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Withdrawal approved"}

@api_router.put("/admin/withdrawals/{withdrawal_id}/reject")
async def reject_withdrawal(withdrawal_id: str, user: dict = Depends(require_admin)):
    withdrawal = await db.withdrawals.find_one({"id": withdrawal_id}, {"_id": 0})
    if not withdrawal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Withdrawal not found")
    
    if withdrawal['status'] != 'pending':
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Withdrawal already processed")
    
    await db.withdrawals.update_one(
        {"id": withdrawal_id},
        {"$set": {
            "status": "rejected",
            "processed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Withdrawal rejected"}

# ===== STATS ROUTE =====
@api_router.get("/stats")
async def get_stats(user: dict = Depends(get_current_user)):
    if user['role'] == 'trader':
        trader = await db.traders.find_one({"user_id": user['id']}, {"_id": 0})
        if trader:
            completed = await db.transactions.count_documents({"trader_id": trader['id'], "status": "completed"})
            pending = await db.transactions.count_documents({"trader_id": trader['id'], "status": "user_confirmed"})
            cards_count = await db.cards.count_documents({"trader_id": trader['id']})
            
            # Get exchange rate
            settings = await db.settings.find_one({}, {"_id": 0})
            usd_to_uah_rate = settings['usd_to_uah_rate'] if settings else 41.5
            
            # Calculate today's stats
            today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            today_transactions = await db.transactions.find({
                "trader_id": trader['id'],
                "status": "completed",
                "completed_at": {"$gte": today_start.isoformat()}
            }, {"_id": 0}).to_list(1000)
            
            today_uah_total = 0
            today_profit = 0
            
            for txn in today_transactions:
                uah_received = txn.get('amount', 0)
                usdt_sent = txn.get('usdt_requested', 0)
                # Profit = UAH received - (USDT sent * 1.04 * rate)
                usdt_cost = usdt_sent * 1.04 * usd_to_uah_rate
                profit = uah_received - usdt_cost
                
                today_uah_total += uah_received
                today_profit += profit
            
            # Calculate total profit (all time)
            all_transactions = await db.transactions.find({
                "trader_id": trader['id'],
                "status": "completed"
            }, {"_id": 0}).to_list(10000)
            
            total_profit = 0
            for txn in all_transactions:
                uah_received = txn.get('amount', 0)
                usdt_sent = txn.get('usdt_requested', 0)
                usdt_cost = usdt_sent * 1.04 * usd_to_uah_rate
                profit = uah_received - usdt_cost
                total_profit += profit
            
            return {
                "balance": trader['usdt_balance'],
                "completed_transactions": completed,
                "pending_transactions": pending,
                "cards_count": cards_count,
                "today_uah_received": round(today_uah_total, 2),
                "today_profit": round(today_profit, 2),
                "total_profit": round(total_profit, 2)
            }
    elif user['role'] == 'admin':
        total_traders = await db.traders.count_documents({})
        total_users = await db.users.count_documents({"role": "user"})
        total_transactions = await db.transactions.count_documents({})
        completed_transactions = await db.transactions.count_documents({"status": "completed"})
        return {
            "total_traders": total_traders,
            "total_users": total_users,
            "total_transactions": total_transactions,
            "completed_transactions": completed_transactions
        }
    else:
        completed = await db.transactions.count_documents({"user_id": user['id'], "status": "completed"})
        pending = await db.transactions.count_documents({"user_id": user['id'], "status": {"$in": ["pending", "user_confirmed"]}})
        return {
            "completed_transactions": completed,
            "pending_transactions": pending
        }

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()