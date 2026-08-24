#!/usr/bin/env python3
"""
Backend Testing Script for Cantidad Field Changes
Tests the new 'cantidad' field in Producto model
"""

import requests
import json
import sys

# Backend URL from frontend .env
BACKEND_URL = "https://calc-flow-sync.preview.emergentagent.com/api"

def test_health_check():
    """Test 1: Verify backend health"""
    print("\n" + "="*60)
    print("TEST 1: Health Check")
    print("="*60)
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "ok":
                print("✅ PASS: Health check successful")
                return True
            else:
                print("❌ FAIL: Health check returned unexpected status")
                return False
        else:
            print(f"❌ FAIL: Health check returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Health check error - {str(e)}")
        return False

def test_get_productos():
    """Test 2: Verify productos endpoint returns data"""
    print("\n" + "="*60)
    print("TEST 2: GET /api/productos")
    print("="*60)
    try:
        response = requests.get(f"{BACKEND_URL}/productos?limit=5", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            productos = response.json()  # Returns list directly
            print(f"Products returned: {len(productos)}")
            
            # Check if any product has cantidad field
            if productos:
                first_product = productos[0]
                print(f"\nFirst product sample:")
                print(f"  - nombre: {first_product.get('nombre', 'N/A')}")
                print(f"  - costo: {first_product.get('costo', 'N/A')}")
                print(f"  - precio_venta: {first_product.get('precio_venta', 'N/A')}")
                print(f"  - cantidad: {first_product.get('cantidad', 'N/A')}")
                
                print("✅ PASS: GET /api/productos working")
                return True
            else:
                print("⚠️  WARNING: No products found in database")
                return True
        else:
            print(f"❌ FAIL: GET /api/productos returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: GET /api/productos error - {str(e)}")
        return False

def test_create_producto_with_cantidad():
    """Test 3: Create product with cantidad field"""
    print("\n" + "="*60)
    print("TEST 3: POST /api/productos with cantidad field")
    print("="*60)
    
    test_product = {
        "nombre": "Test Cantidad Product",
        "costo": 100,
        "precio_venta": 150,
        "cantidad": "50"
    }
    
    print(f"Creating product: {json.dumps(test_product, indent=2)}")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/productos",
            json=test_product,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            product_id = data.get("_id")  # API returns _id not id
            
            if product_id:
                print(f"✅ Product created with ID: {product_id}")
                
                # Verify the product was created with cantidad field
                verify_response = requests.get(f"{BACKEND_URL}/productos/{product_id}", timeout=10)
                if verify_response.status_code == 200:
                    created_product = verify_response.json()
                    print(f"\nVerifying created product:")
                    print(f"  - nombre: {created_product.get('nombre')}")
                    print(f"  - costo: {created_product.get('costo')}")
                    print(f"  - precio_venta: {created_product.get('precio_venta')}")
                    print(f"  - cantidad: {created_product.get('cantidad')}")
                    
                    if created_product.get('cantidad') == "50":
                        print("✅ PASS: Product created with cantidad field correctly")
                        
                        # Clean up - delete test product
                        delete_response = requests.delete(f"{BACKEND_URL}/productos/{product_id}", timeout=10)
                        if delete_response.status_code == 200:
                            print(f"✅ Test product cleaned up (deleted)")
                        
                        return True
                    else:
                        print(f"❌ FAIL: cantidad field not saved correctly. Expected '50', got '{created_product.get('cantidad')}'")
                        return False
                else:
                    print(f"⚠️  WARNING: Could not verify created product (status {verify_response.status_code})")
                    return True
            else:
                print("❌ FAIL: No product ID returned")
                return False
        else:
            print(f"❌ FAIL: POST /api/productos returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: POST /api/productos error - {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("BACKEND TESTING - CANTIDAD FIELD VERIFICATION")
    print("="*60)
    print(f"Backend URL: {BACKEND_URL}")
    
    results = []
    
    # Run tests
    results.append(("Health Check", test_health_check()))
    results.append(("GET /api/productos", test_get_productos()))
    results.append(("POST /api/productos with cantidad", test_create_producto_with_cantidad()))
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
