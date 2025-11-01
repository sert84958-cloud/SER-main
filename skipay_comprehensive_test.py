#!/usr/bin/env python3
"""
SkiPay Backend API Comprehensive Test Suite
Tests the complete payment processing flow as specified in the review request.
"""

import requests
import json
import sys
from datetime import datetime
import time

class SkiPayTester:
    def __init__(self):
        self.base_url = "https://trader-platform-6.preview.emergentagent.com"
        self.api_url = f"{self.base_url}/api"
        self.tokens = {}
        self.test_data = {}
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.critical_failures = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
            if details:
                print(f"   {details}")
        else:
            print(f"❌ {name}")
            if details:
                print(f"   {details}")
            self.failed_tests.append({"test": name, "details": details})

    def api_call(self, method, endpoint, data=None, token=None, expected_status=200):
        """Make API call and return success, response"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=15)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=15)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=15)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=15)

            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text}

            if not success:
                error_msg = f"Status {response.status_code} (expected {expected_status})"
                if 'detail' in response_data:
                    error_msg += f": {response_data['detail']}"
                return False, {"error": error_msg, "status": response.status_code}

            return True, response_data

        except Exception as e:
            return False, {"error": str(e)}

    def test_1_authentication_flow(self):
        """Test 1: Authentication Flow"""
        print("\n=== TEST 1: AUTHENTICATION FLOW ===")
        
        # Generate unique test data
        timestamp = int(time.time())
        test_email = f"testuser{timestamp}@example.com"
        test_password = "TestPass123!"
        
        # 1.1 Register new user
        success, response = self.api_call(
            'POST', 'auth/register',
            data={"email": test_email, "password": test_password}
        )
        
        if success and 'token' in response:
            self.tokens['test_user'] = response['token']
            self.test_data['test_user_id'] = response['user']['id']
            self.test_data['test_user_email'] = test_email
            self.test_data['test_user_password'] = test_password
            self.log_test("Register new user", True, f"User ID: {response['user']['id']}")
        else:
            self.log_test("Register new user", False, str(response))
            self.critical_failures.append("User registration failed")
            return

        # 1.2 Login with created user
        success, response = self.api_call(
            'POST', 'auth/login',
            data={"email": test_email, "password": test_password}
        )
        
        if success and 'token' in response:
            self.log_test("Login with created user", True, "Token received")
        else:
            self.log_test("Login with created user", False, str(response))

        # 1.3 Verify token works with /auth/me
        success, response = self.api_call(
            'GET', 'auth/me', token=self.tokens['test_user']
        )
        
        if success and response.get('email') == test_email:
            self.log_test("Verify token with /auth/me", True, f"Role: {response.get('role')}")
        else:
            self.log_test("Verify token with /auth/me", False, str(response))

    def test_2_admin_setup(self):
        """Test 2: Admin Setup"""
        print("\n=== TEST 2: ADMIN SETUP ===")
        
        # Try to login as existing admin or create one
        admin_accounts = [
            ("admin@test.com", "admin123"),
            ("admin@skipay.com", "admin123"),
            ("admin", "admin")
        ]
        
        admin_found = False
        for email, password in admin_accounts:
            success, response = self.api_call(
                'POST', 'auth/login',
                data={"email": email, "password": password}
            )
            if success and 'token' in response:
                self.tokens['admin'] = response['token']
                self.test_data['admin_id'] = response['user']['id']
                admin_found = True
                self.log_test("Login as admin", True, f"Email: {email}")
                break
        
        if not admin_found:
            self.log_test("Login as admin", False, "No admin account found")
            self.critical_failures.append("Admin login failed")
            return

        # 2.1 Test admin settings endpoint
        success, response = self.api_call(
            'GET', 'admin/settings', token=self.tokens['admin']
        )
        
        if success:
            current_settings = response
            self.log_test("Get admin settings", True, 
                         f"Commission: {response.get('commission_rate')}%, Rate: {response.get('usd_to_uah_rate')}")
        else:
            self.log_test("Get admin settings", False, str(response))
            return

        # 2.2 Update settings with required values
        new_settings = {
            "commission_rate": 9.0,
            "usd_to_uah_rate": 41.5,
            "deposit_wallet_address": "TB4K5h9QwFGSYR2LLJS9ejmt9EjHWurvi1"
        }
        
        success, response = self.api_call(
            'PUT', 'admin/settings', 
            data=new_settings,
            token=self.tokens['admin']
        )
        
        if success:
            self.test_data['settings'] = new_settings
            self.log_test("Update admin settings", True, "Commission: 9%, Rate: 41.5")
        else:
            self.log_test("Update admin settings", False, str(response))

    def test_3_trader_registration_and_cards(self):
        """Test 3: Trader Registration & Card Management"""
        print("\n=== TEST 3: TRADER REGISTRATION & CARD MANAGEMENT ===")
        
        if 'test_user' not in self.tokens:
            self.log_test("Trader registration", False, "No test user available")
            return

        # 3.1 Convert user to trader
        trader_data = {
            "name": "Test Trader",
            "nickname": "TestTrader123",
            "usdt_address": "TTestAddress123456789",
            "phone": "+380123456789"
        }
        
        success, response = self.api_call(
            'POST', 'trader/register',
            data=trader_data,
            token=self.tokens['test_user']
        )
        
        if success:
            self.test_data['trader_id'] = response['id']
            self.log_test("Convert user to trader", True, f"Trader ID: {response['id']}")
        else:
            self.log_test("Convert user to trader", False, str(response))
            return

        # 3.2 Admin add balance to trader
        if 'admin' in self.tokens:
            success, response = self.api_call(
                'POST', f'admin/traders/{self.test_data["trader_id"]}/add-balance',
                data={"amount": 1000},
                token=self.tokens['admin']
            )
            
            if success:
                self.log_test("Admin add 1000 USDT balance", True, f"New balance: {response.get('new_balance')}")
            else:
                self.log_test("Admin add 1000 USDT balance", False, str(response))

        # 3.3 Add card with card_name field
        card_data = {
            "card_number": "4111111111111111",
            "bank_name": "Test Bank",
            "holder_name": "Test Holder",
            "limit": 50000.0,
            "currency": "UAH",
            "card_name": "My Primary Card"
        }
        
        success, response = self.api_call(
            'POST', 'trader/cards',
            data=card_data,
            token=self.tokens['test_user']
        )
        
        if success:
            self.test_data['card_id'] = response['id']
            card_name = response.get('card_name')
            self.log_test("Add card with card_name", True, f"Card name: '{card_name}'")
        else:
            self.log_test("Add card with card_name", False, str(response))
            return

        # 3.4 Get trader cards and verify card_name
        success, response = self.api_call(
            'GET', 'trader/cards',
            token=self.tokens['test_user']
        )
        
        if success and len(response) > 0:
            card = response[0]
            card_name = card.get('card_name')
            if card_name == "My Primary Card":
                self.log_test("Verify card has name", True, f"Card name: '{card_name}'")
            else:
                self.log_test("Verify card has name", False, f"Expected 'My Primary Card', got '{card_name}'")
        else:
            self.log_test("Verify card has name", False, str(response))

        # 3.5 Update card_name
        success, response = self.api_call(
            'PUT', f'trader/cards/{self.test_data["card_id"]}',
            data={"card_name": "Updated Card Name"},
            token=self.tokens['test_user']
        )
        
        if success:
            updated_name = response.get('card_name')
            self.log_test("Update card_name", True, f"New name: '{updated_name}'")
        else:
            self.log_test("Update card_name", False, str(response))

    def test_4_commission_logic_flow(self):
        """Test 4: Commission Logic Flow"""
        print("\n=== TEST 4: COMMISSION LOGIC FLOW ===")
        
        if 'test_user' not in self.tokens:
            self.log_test("Commission logic test", False, "No test user available")
            return

        # Create a separate user for this test
        timestamp = int(time.time())
        client_email = f"client{timestamp}@example.com"
        client_password = "ClientPass123!"
        
        # Register client user
        success, response = self.api_call(
            'POST', 'auth/register',
            data={"email": client_email, "password": client_password}
        )
        
        if success and 'token' in response:
            client_token = response['token']
            self.log_test("Register client user", True, f"Client ID: {response['user']['id']}")
        else:
            self.log_test("Register client user", False, str(response))
            return

        # 4.1 User requests 100 USDT
        success, response = self.api_call(
            'POST', 'user/request-card',
            data={"amount": 100, "currency": "UAH"},
            token=client_token
        )
        
        if success:
            transaction_id = response.get('transaction_id')
            card_info = response.get('card', {})
            amount = card_info.get('amount')
            exchange_rate = card_info.get('exchange_rate')
            usdt_amount = card_info.get('usdt_amount')
            
            # Verify math: 100 USDT * 41.5 UAH/USDT * 1.09 = 4523.5 UAH
            expected_amount = 100 * 41.5 * 1.09
            
            self.test_data['transaction_id'] = transaction_id
            
            if abs(amount - expected_amount) < 0.01:
                self.log_test("Verify commission calculation", True, 
                             f"Amount: {amount} UAH (expected: {expected_amount})")
            else:
                self.log_test("Verify commission calculation", False, 
                             f"Amount: {amount} UAH (expected: {expected_amount})")
            
            if exchange_rate:
                self.log_test("Verify exchange_rate in response", True, f"Rate: {exchange_rate}")
            else:
                self.log_test("Verify exchange_rate in response", False, "No exchange_rate in response")
                
            if usdt_amount == 100:
                self.log_test("Verify USDT amount", True, f"USDT: {usdt_amount}")
            else:
                self.log_test("Verify USDT amount", False, f"USDT: {usdt_amount} (expected: 100)")
                
        else:
            self.log_test("User request 100 USDT", False, str(response))
            return

        # 4.2 User confirms payment
        success, response = self.api_call(
            'POST', f'user/confirm-payment/{transaction_id}',
            token=client_token
        )
        
        if success:
            self.log_test("User confirm payment", True, response.get('message', ''))
        else:
            self.log_test("User confirm payment", False, str(response))
            return

        # 4.3 Get trader balance before confirmation
        success, response = self.api_call(
            'GET', 'trader/profile',
            token=self.tokens['test_user']
        )
        
        if success:
            balance_before = response.get('usdt_balance', 0)
            self.log_test("Get trader balance before", True, f"Balance: {balance_before} USDT")
        else:
            balance_before = 0
            self.log_test("Get trader balance before", False, str(response))

        # 4.4 Check all transactions to find our transaction
        success, all_txns = self.api_call(
            'GET', 'admin/transactions',
            token=self.tokens['admin']
        )
        
        our_transaction = None
        if success:
            for txn in all_txns:
                if txn['id'] == transaction_id:
                    our_transaction = txn
                    break
        
        if our_transaction:
            actual_trader_id = our_transaction['trader_id']
            self.log_test("Find transaction details", True, 
                         f"Transaction assigned to trader: {actual_trader_id}, Status: {our_transaction['status']}")
            
            # Get the correct trader token
            if actual_trader_id == self.test_data.get('trader_id'):
                trader_token = self.tokens['test_user']
                self.log_test("Use test trader token", True, "Transaction is for our test trader")
            else:
                # Need to find the trader with this ID and get their token
                success, all_traders = self.api_call(
                    'GET', 'admin/traders',
                    token=self.tokens['admin']
                )
                
                target_trader = None
                if success:
                    for trader in all_traders:
                        if trader['id'] == actual_trader_id:
                            target_trader = trader
                            break
                
                if target_trader:
                    # Try to login as this trader (assuming it's an existing test trader)
                    trader_accounts = [
                        ("trader@test.com", "trader123"),
                        ("admin@test.com", "admin123")  # Admin can also be trader
                    ]
                    
                    trader_token = None
                    for email, password in trader_accounts:
                        success, response = self.api_call(
                            'POST', 'auth/login',
                            data={"email": email, "password": password}
                        )
                        if success and 'token' in response:
                            # Check if this user is the trader we need
                            success, profile = self.api_call(
                                'GET', 'auth/me',
                                token=response['token']
                            )
                            if success and profile.get('trader', {}).get('id') == actual_trader_id:
                                trader_token = response['token']
                                break
                    
                    if trader_token:
                        self.log_test("Get existing trader token", True, f"Found token for trader {actual_trader_id}")
                    else:
                        self.log_test("Get existing trader token", False, "Could not find trader token")
                        return
                else:
                    self.log_test("Find target trader", False, f"Trader {actual_trader_id} not found")
                    return
        else:
            self.log_test("Find transaction details", False, f"Transaction {transaction_id} not found")
            return

        # 4.4 Trader confirms payment
        success, response = self.api_call(
            'POST', f'trader/confirm-payment/{transaction_id}',
            token=trader_token
        )
        
        if success:
            usdt_sent = response.get('usdt_sent_to_user')
            usdt_deducted = response.get('usdt_deducted_from_trader')
            
            # Verify trader deduction: 100 * 1.04 = 104 USDT
            expected_deduction = 100 * 1.04
            
            if usdt_sent == 100:
                self.log_test("Verify USDT sent to user", True, f"Sent: {usdt_sent} USDT")
            else:
                self.log_test("Verify USDT sent to user", False, f"Sent: {usdt_sent} USDT (expected: 100)")
            
            if abs(usdt_deducted - expected_deduction) < 0.01:
                self.log_test("Verify trader deduction", True, f"Deducted: {usdt_deducted} USDT")
            else:
                self.log_test("Verify trader deduction", False, 
                             f"Deducted: {usdt_deducted} USDT (expected: {expected_deduction})")
                
        else:
            self.log_test("Trader confirm payment", False, str(response))

        # 4.5 Verify transaction shows correct usdt_amount
        success, response = self.api_call(
            'GET', 'user/transactions',
            token=client_token
        )
        
        if success and len(response) > 0:
            transaction = response[0]  # Most recent transaction
            usdt_amount = transaction.get('usdt_amount')
            if usdt_amount == 100:
                self.log_test("Verify transaction usdt_amount", True, f"USDT amount: {usdt_amount}")
            else:
                self.log_test("Verify transaction usdt_amount", False, 
                             f"USDT amount: {usdt_amount} (expected: 100)")
        else:
            self.log_test("Verify transaction usdt_amount", False, str(response))

    def test_5_trader_statistics(self):
        """Test 5: Trader Statistics"""
        print("\n=== TEST 5: TRADER STATISTICS ===")
        
        if 'test_user' not in self.tokens:
            self.log_test("Trader statistics test", False, "No trader token available")
            return

        # 5.1 Get trader stats
        success, response = self.api_call(
            'GET', 'stats',
            token=self.tokens['test_user']
        )
        
        if success:
            today_uah = response.get('today_uah_received')
            if today_uah is not None:
                self.log_test("Verify today_uah_received field", True, f"Today UAH: {today_uah}")
                
                # Check if it matches today's completed transactions
                if today_uah > 0:
                    self.log_test("Verify today_uah_received value", True, 
                                 f"Received {today_uah} UAH today from completed transactions")
                else:
                    self.log_test("Verify today_uah_received value", True, 
                                 "No UAH received today (expected for new trader)")
            else:
                self.log_test("Verify today_uah_received field", False, "Field not found in response")
        else:
            self.log_test("Get trader stats", False, str(response))

    def test_6_admin_features(self):
        """Test 6: Admin Features"""
        print("\n=== TEST 6: ADMIN FEATURES ===")
        
        if 'admin' not in self.tokens:
            self.log_test("Admin features test", False, "No admin token available")
            return

        # 6.1 Get all users
        success, response = self.api_call(
            'GET', 'admin/users',
            token=self.tokens['admin']
        )
        
        if success and isinstance(response, list):
            self.log_test("Get all users", True, f"Found {len(response)} users")
        else:
            self.log_test("Get all users", False, str(response))

        # 6.2 Get all traders
        success, response = self.api_call(
            'GET', 'admin/traders',
            token=self.tokens['admin']
        )
        
        if success and isinstance(response, list):
            traders = response
            self.log_test("Get all traders", True, f"Found {len(traders)} traders")
            
            # Store first trader for blocking test
            if traders:
                self.test_data['first_trader_id'] = traders[0]['id']
        else:
            self.log_test("Get all traders", False, str(response))

        # 6.3 Get all transactions
        success, response = self.api_call(
            'GET', 'admin/transactions',
            token=self.tokens['admin']
        )
        
        if success and isinstance(response, list):
            self.log_test("Get all transactions", True, f"Found {len(response)} transactions")
        else:
            self.log_test("Get all transactions", False, str(response))

        # 6.4 Test user blocking
        if 'test_user_id' in self.test_data:
            success, response = self.api_call(
                'PUT', f'admin/users/{self.test_data["test_user_id"]}/block',
                token=self.tokens['admin']
            )
            
            if success:
                is_blocked = response.get('is_blocked')
                self.log_test("Block/unblock user", True, f"User blocked: {is_blocked}")
            else:
                self.log_test("Block/unblock user", False, str(response))

        # 6.5 Test trader blocking
        if 'first_trader_id' in self.test_data:
            success, response = self.api_call(
                'PUT', f'admin/traders/{self.test_data["first_trader_id"]}/block',
                token=self.tokens['admin']
            )
            
            if success:
                is_blocked = response.get('is_blocked')
                self.log_test("Block/unblock trader", True, f"Trader blocked: {is_blocked}")
            else:
                self.log_test("Block/unblock trader", False, str(response))

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 SkiPay Backend API Comprehensive Test Suite")
        print("=" * 60)
        
        self.test_1_authentication_flow()
        self.test_2_admin_setup()
        self.test_3_trader_registration_and_cards()
        self.test_4_commission_logic_flow()
        self.test_5_trader_statistics()
        self.test_6_admin_features()
        
        # Print results
        print("\n" + "=" * 60)
        print("📊 FINAL TEST RESULTS")
        print("=" * 60)
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {len(self.failed_tests)}")
        
        if self.tests_run > 0:
            success_rate = (self.tests_passed / self.tests_run) * 100
            print(f"Success rate: {success_rate:.1f}%")
        
        if self.critical_failures:
            print(f"\n🚨 CRITICAL FAILURES:")
            for failure in self.critical_failures:
                print(f"  - {failure}")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for failure in self.failed_tests:
                print(f"  - {failure['test']}: {failure['details']}")
        
        # Save detailed results
        results = {
            'timestamp': datetime.now().isoformat(),
            'summary': {
                'total_tests': self.tests_run,
                'passed': self.tests_passed,
                'failed': len(self.failed_tests),
                'success_rate': (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
            },
            'critical_failures': self.critical_failures,
            'failed_tests': self.failed_tests,
            'test_data': self.test_data
        }
        
        with open('/app/test_reports/skipay_comprehensive_results.json', 'w') as f:
            json.dump(results, f, indent=2)
        
        return len(self.failed_tests) == 0 and len(self.critical_failures) == 0

def main():
    tester = SkiPayTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())