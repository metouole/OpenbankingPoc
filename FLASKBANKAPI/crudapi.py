from flask import Flask, jsonify, request, abort
from flask_restx import Api, Resource
import requests
from flask_cors import CORS
from jose import jwt, jwk
from jose.exceptions import JWTError

import crud

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests
api = Api(app)

# Keycloak configuration
KEYCLOAK_URL = 'http://localhost:8181'  # Keycloak server URL
REALM_NAME = 'mobilebank'
CLIENT_ID = 'account'
PUBLIC_KEY_URL = f'http://localhost:8181/realms/{REALM_NAME}/protocol/openid-connect/certs'

def get_public_key(kid=None):
    try:
        response = requests.get(PUBLIC_KEY_URL)
        response.raise_for_status()
        keys = response.json().get('keys', [])
        if not keys:
            raise Exception("No public keys found in Keycloak configuration.")
        
        # If kid is provided, find the matching key
        if kid:
            key = next((k for k in keys if k['kid'] == kid), None)
            if not key:
                raise Exception(f"Key ID {kid} not found in Keycloak configuration.")
        else:
            key = keys[0]  # Use the first key if kid is not provided
        
        jwk_key = jwk.construct(key)
        pem_key = jwk_key.to_pem()
        return pem_key
    except requests.RequestException as e:
        abort(500, description=f"Error fetching public key: {str(e)}")
    except Exception as e:
        abort(500, description=f"Error processing public key: {str(e)}")

def verify_token(token):
    try:
        # Decode the token header to get the key ID (kid)
        headers = jwt.get_unverified_headers(token)
        kid = headers.get('kid')
        if not kid:
            abort(401, description="No Key ID in token header")

        # Fetch the public key using the kid
        public_key = get_public_key(kid)
        decoded_token = jwt.decode(token, public_key, algorithms=['RS256'], audience=CLIENT_ID)
        return decoded_token
    except jwt.ExpiredSignatureError:
        abort(401, description="Token has expired")
    except jwt.JWTClaimsError as e:
        abort(401, description=f"Token claims error: {str(e)}")
    except JWTError as e:
        abort(401, description=f"Token validation error: {str(e)}")
    except Exception as e:
        abort(401, description=f"Error decoding token headers: {str(e)}")

def token_required(f):
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            abort(401, description="Authorization header is missing")
        
        token_parts = auth_header.split(" ")
        if len(token_parts) != 2 or token_parts[0] != 'Bearer':
            abort(401, description="Invalid Authorization header format")
        
        token = token_parts[1]
        verify_token(token)
        return f(*args, **kwargs)
    return wrapper

@api.route('/customers_identity')
class Customer(Resource):
    #@token_required
    def get(self):
        try:
            result = crud.read_customers()
            return jsonify(result)
        except Exception as e:
            return {'error': str(e)}, 500

@api.route('/transactions_history')
class Transaction(Resource):
    @token_required
    def get(self):
        try:
            result = crud.read_transactions()
            return jsonify(result)
        except Exception as e:
            return {'error': str(e)}, 500

@api.route('/paiement_initiation/<int:id>/<int:amount>')
class Paiement(Resource):
    @token_required
    def put(self, id: int, amount: int):
        try:
            result = crud.paiement_transaction(id, amount)
            return jsonify(result)
        except Exception as e:
            return {'error': str(e)}, 500

if __name__ == '__main__':
    app.run(debug=True)
