#!/usr/bin/env python3
"""
Скрипт для создания тестовых аккаунтов SkiPay
"""
import asyncio
import os
import sys
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import bcrypt
import uuid

# Load environment
ROOT_DIR = Path(__file__).parent / 'backend'
load_dotenv(ROOT_DIR / '.env')

async def create_test_accounts():
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🔄 Подключение к MongoDB...")
    print(f"Database: {db_name}")
    
    # Clear existing test accounts
    print("\n🗑️  Очистка старых тестовых аккаунтов...")
    test_emails = [
        'admin@skipay.com',
        'trader@skipay.com', 
        'user@skipay.com'
    ]
    
    for email in test_emails:
        await db.users.delete_many({'email': email})
        await db.traders.delete_many({'email': email})
    
    # Helper function to hash password
    def hash_password(password: str) -> str:
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Create Admin account
    print("\n👨‍💼 Создание аккаунта Администратора...")
    admin = {
        'id': str(uuid.uuid4()),
        'email': 'admin@skipay.com',
        'password_hash': hash_password('admin123'),
        'role': 'admin',
        'is_blocked': False,
        'is_approved': True,
        'created_at': datetime.now().isoformat()
    }
    await db.users.insert_one(admin)
    print(f"✅ Admin создан: {admin['email']} / admin123")
    
    # Create Trader account
    print("\n💼 Создание аккаунта Трейдера...")
    trader = {
        'id': str(uuid.uuid4()),
        'email': 'trader@skipay.com',
        'password_hash': hash_password('trader123'),
        'role': 'trader',
        'is_blocked': False,
        'is_approved': True,
        'created_at': datetime.now().isoformat()
    }
    await db.users.insert_one(trader)
    
    # Create trader profile with balance and card
    trader_profile = {
        'id': str(uuid.uuid4()),
        'user_id': trader['id'],
        'email': trader['email'],
        'usdt_balance': 5000.0,
        'is_working': True,
        'deposit_wallet_address': ''
    }
    await db.traders.insert_one(trader_profile)
    
    # Add a test card for trader
    card = {
        'id': str(uuid.uuid4()),
        'trader_id': trader['id'],
        'card_number': '5168742012345678',
        'bank_name': 'ПриватБанк',
        'holder_name': 'IVAN PETRENKO',
        'limit': 100000,
        'currency': 'UAH',
        'status': 'active',
        'card_name': 'Основная карта для тестов',
        'created_at': datetime.now().isoformat()
    }
    await db.cards.insert_one(card)
    
    print(f"✅ Trader создан: {trader['email']} / trader123")
    print(f"   💰 Баланс: 5000 USDT")
    print(f"   💳 Карта добавлена: {card['card_name']}")
    
    # Create User account
    print("\n👤 Создание аккаунта Пользователя...")
    user = {
        'id': str(uuid.uuid4()),
        'email': 'user@skipay.com',
        'password_hash': hash_password('user123'),
        'role': 'user',
        'is_blocked': False,
        'is_approved': True,
        'created_at': datetime.now().isoformat()
    }
    await db.users.insert_one(user)
    print(f"✅ User создан: {user['email']} / user123")
    
    # Create settings if not exists
    settings = await db.settings.find_one({})
    if not settings:
        print("\n⚙️  Создание настроек системы...")
        settings = {
            'id': str(uuid.uuid4()),
            'commission_rate': 9.0,
            'usd_to_uah_rate': 41.5,
            'deposit_wallet_address': 'TB4KSh9QwFGSYR2LJS9ejmt9EJHurv1i1'
        }
        await db.settings.insert_one(settings)
        print(f"✅ Настройки созданы:")
        print(f"   📊 Комиссия: {settings['commission_rate']}%")
        print(f"   💱 Курс: 1 USDT = {settings['usd_to_uah_rate']} UAH")
    
    print("\n" + "="*60)
    print("✅ ВСЕ ТЕСТОВЫЕ АККАУНТЫ УСПЕШНО СОЗДАНЫ!")
    print("="*60)
    print("\n📋 ДАННЫЕ ДЛЯ ВХОДА:\n")
    print("👨‍💼 АДМИНИСТРАТОР:")
    print("   Email: admin@skipay.com")
    print("   Пароль: admin123")
    print("   Роль: Полный доступ ко всем функциям\n")
    
    print("💼 ТРЕЙДЕР:")
    print("   Email: trader@skipay.com")
    print("   Пароль: trader123")
    print("   Баланс: 5000 USDT")
    print("   Карта: Основная карта для тестов (ПриватБанк)\n")
    
    print("👤 ПОЛЬЗОВАТЕЛЬ:")
    print("   Email: user@skipay.com")
    print("   Пароль: user123")
    print("   Роль: Может создавать заявки на пополнение\n")
    
    print("="*60)
    print("🚀 Можно начинать тестирование!")
    print("="*60)
    
    client.close()

if __name__ == '__main__':
    from datetime import datetime
    asyncio.run(create_test_accounts())
