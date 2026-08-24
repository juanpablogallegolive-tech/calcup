#!/usr/bin/env python3
"""
Backend API Testing for Spanish Calculator App - Flujos CRUD Operations
Tests the specific endpoints requested in the review request
"""

import requests
import json
import sys
from datetime import datetime

# Configuration - Use the specific URL from the review request
BASE_URL = "https://calc-flow-sync.preview.emergentagent.com/api"

class FlujosAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.created_flow_id = None
        
    def log(self, message):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] {message}")
        
    def test_get_flujos_initial(self):
        """Test 1: GET /api/flujos - Get initial flows"""
        self.log("Testing GET /api/flujos - Get initial flows")
        try:
            response = self.session.get(f"{self.base_url}/flujos")
            response.raise_for_status()
            
            flows = response.json()
            self.log(f"✅ GET /api/flujos successful - Found {len(flows)} existing flows")
            
            for i, flow in enumerate(flows[:3]):  # Show first 3 flows
                self.log(f"   Flow {i+1}: {flow.get('nombre', 'No name')} (ID: {flow.get('_id', 'No ID')})")
            
            return True, flows
            
        except requests.exceptions.RequestException as e:
            self.log(f"❌ GET /api/flujos failed - Error: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                self.log(f"   Response status: {e.response.status_code}")
                self.log(f"   Response body: {e.response.text}")
            return False, None
            
    def test_create_flujo(self):
        """Test 2: POST /api/flujos - Create new flow"""
        self.log("Testing POST /api/flujos - Create new flow")
        
        # Test data as specified in the request
        test_flow = {
            "nombre": "Flujo de Prueba",
            "operaciones": [
                {
                    "nombre": "Operacion Test",
                    "tipo_operacion": "Sumar",
                    "tipo_valor": "Porcentaje",
                    "orden": 0
                }
            ]
        }
        
        try:
            response = self.session.post(
                f"{self.base_url}/flujos",
                data=json.dumps(test_flow)
            )
            response.raise_for_status()
            
            created_flow = response.json()
            self.created_flow_id = created_flow.get('_id')
            
            self.log(f"✅ POST /api/flujos successful - Created flow with ID: {self.created_flow_id}")
            self.log(f"   Flow name: {created_flow.get('nombre')}")
            self.log(f"   Operations count: {len(created_flow.get('operaciones', []))}")
            
            return True, created_flow
            
        except requests.exceptions.RequestException as e:
            self.log(f"❌ POST /api/flujos failed - Error: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                self.log(f"   Response status: {e.response.status_code}")
                self.log(f"   Response body: {e.response.text}")
            return False, None
            
    def test_verify_created_flujo(self):
        """Test 3: GET /api/flujos - Verify the new flow appears"""
        self.log("Testing GET /api/flujos - Verify new flow appears")
        
        try:
            response = self.session.get(f"{self.base_url}/flujos")
            response.raise_for_status()
            
            flows = response.json()
            
            # Look for our created flow
            created_flow_found = None
            for flow in flows:
                if flow.get('_id') == self.created_flow_id:
                    created_flow_found = flow
                    break
            
            if created_flow_found:
                self.log(f"✅ GET /api/flujos verification successful - New flow found in list")
                self.log(f"   Flow name: {created_flow_found.get('nombre')}")
                self.log(f"   Flow ID: {created_flow_found.get('_id')}")
                return True, created_flow_found
            else:
                self.log(f"❌ GET /api/flujos verification failed - New flow not found in list")
                self.log(f"   Looking for ID: {self.created_flow_id}")
                self.log(f"   Total flows in list: {len(flows)}")
                return False, None
                
        except requests.exceptions.RequestException as e:
            self.log(f"❌ GET /api/flujos verification failed - Error: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                self.log(f"   Response status: {e.response.status_code}")
                self.log(f"   Response body: {e.response.text}")
            return False, None
            
    def test_delete_flujo(self):
        """Test 4: DELETE /api/flujos/{id} - Delete the test flow"""
        if not self.created_flow_id:
            self.log("❌ DELETE test skipped - No flow ID available")
            return False, None
            
        self.log(f"Testing DELETE /api/flujos/{self.created_flow_id} - Delete test flow")
        
        try:
            response = self.session.delete(f"{self.base_url}/flujos/{self.created_flow_id}")
            response.raise_for_status()
            
            delete_result = response.json()
            self.log(f"✅ DELETE /api/flujos/{self.created_flow_id} successful")
            self.log(f"   Response: {delete_result.get('message', 'No message')}")
            
            return True, delete_result
            
        except requests.exceptions.RequestException as e:
            self.log(f"❌ DELETE /api/flujos/{self.created_flow_id} failed - Error: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                self.log(f"   Response status: {e.response.status_code}")
                self.log(f"   Response body: {e.response.text}")
            return False, None
            
    def run_all_tests(self):
        """Run all flujos API tests in sequence"""
        self.log("=" * 60)
        self.log("Starting Flujos API Tests for Spanish Calculator App")
        self.log("=" * 60)
        
        test_results = {}
        
        # Test 1: Initial GET
        success, data = self.test_get_flujos_initial()
        test_results['get_initial'] = success
        
        # Test 2: POST (Create)
        success, data = self.test_create_flujo()
        test_results['create'] = success
        
        if success:
            # Test 3: GET (Verify)
            success, data = self.test_verify_created_flujo()
            test_results['verify'] = success
            
            # Test 4: DELETE
            success, data = self.test_delete_flujo()
            test_results['delete'] = success
        else:
            test_results['verify'] = False
            test_results['delete'] = False
            self.log("⚠️  Skipping verification and delete tests due to create failure")
        
        # Summary
        self.log("=" * 60)
        self.log("TEST SUMMARY")
        self.log("=" * 60)
        
        all_passed = True
        for test_name, result in test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name.upper()}: {status}")
            if not result:
                all_passed = False
        
        self.log("=" * 60)
        final_status = "✅ ALL TESTS PASSED" if all_passed else "❌ SOME TESTS FAILED"
        self.log(f"OVERALL RESULT: {final_status}")
        self.log("=" * 60)
        
        return all_passed, test_results

if __name__ == "__main__":
    tester = FlujosAPITester()
    success, results = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)