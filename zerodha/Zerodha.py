import json
import os
from typing import Dict, Optional, List, Any
import requests
import pyotp
from kiteconnect import KiteConnect
from kiteconnect import KiteTicker
import datetime as dt
import struct
import logging
import sys
import time

logging.basicConfig(stream=sys.stdout, level=logging.WARNING,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

class Zerodha:
    def __init__(self):
        self.credentials: Optional[Dict] = None
        self.config_path = "zerodhaConfig.json"
        self.token_path = "zerodhaAccessToken.json"
        self.kite = None
        self.kws = None
        self.base_url = "https://kite.zerodha.com"
        self.login_url = "https://kite.zerodha.com/api/login"
        self.twofa_url = "https://kite.zerodha.com/api/twofa"
        self.tokens = []
        self.check = 0
        # Add a dictionary to store token:ltp pairs
        self.token_ltp = {}  # Dictionary to store latest prices
        self.token_full_data = {}  # Dictionary to store full tick data

    def load_credentials(self) -> Dict:
        """
        Load credentials from the configuration file.
        
        Returns:
            Dict: Dictionary containing Zerodha credentials
            
        Raises:
            FileNotFoundError: If the configuration file doesn't exist
            json.JSONDecodeError: If the configuration file is not valid JSON
        """
        if not os.path.exists(self.config_path):
            raise FileNotFoundError(f"Configuration file not found at {self.config_path}")
            
        with open(self.config_path, 'r') as f:
            self.credentials = json.load(f)
            
        return self.credentials
    
    def load_saved_token(self) -> Optional[str]:
        """
        Load saved access token if it exists and is from current day
        """
        try:
            if not os.path.exists(self.token_path):
                return None
                
            with open(self.token_path, 'r') as f:
                token_data = json.load(f)
                
            saved_date = dt.datetime.strptime(token_data['date'], '%Y-%m-%d').date()
            current_date = dt.datetime.now().date()
            
            if saved_date == current_date:
                return token_data['access_token']
            return None
            
        except Exception:
            return None

    def save_token(self, access_token: str):
        """
        Save access token with current date
        """
        token_data = {
            'date': dt.datetime.now().strftime('%Y-%m-%d'),
            'access_token': access_token
        }
        with open(self.token_path, 'w') as f:
            json.dump(token_data, f)

    def login(self) -> bool:
        """
        Login to Zerodha using credentials from the configuration file.
        
        Returns:
            bool: True if login is successful, False otherwise
        """
        try:
            if not self.credentials:
                self.load_credentials()

            # Try to load saved token first
            saved_token = self.load_saved_token()
            if saved_token:
                self.kite = KiteConnect(api_key=self.credentials['api_key'])
                self.kite.set_access_token(saved_token)
                return True

            # If no valid saved token, proceed with login
            session = requests.Session()
            response = session.post(
                self.login_url,
                data={
                    'user_id': self.credentials['user_id'],
                    'password': self.credentials['password']
                }
            )
            print(response.text)
            request_id = json.loads(response.text)['data']['request_id']
            print(request_id)
            twofa_pin = pyotp.TOTP(self.credentials['totp']).now()
            
            response_1 = session.post(
                self.twofa_url,
                data={
                    'user_id': self.credentials['user_id'],
                    'request_id': request_id,
                    'twofa_value': twofa_pin,
                    'twofa_type': 'totp'
                }
            )
            print(response_1.text)
            self.kite = KiteConnect(api_key=self.credentials['api_key'])
            kite_url = self.kite.login_url()
            response = session.get(kite_url)
            request_token = response.url.split('request_token=')[1].split('&')[0]
            # print('Successful Login with Request Token:{}'.format(request_token))
            
            access_token = self.kite.generate_session(
                request_token,
                self.credentials['api_secret']
            )['access_token']
            
            # Save the new access token
            self.save_token(access_token)
            
            self.kite.set_access_token(access_token)
            print("Successfully logged in to Zerodha!")
            return True
                
        except Exception as e:
            print(f"Login failed: {str(e)}")
            return False
    
    def get_instrument_tokens(self, symbols: List[str]) -> List[int]:
        """
        Get instrument tokens for given symbols
        
        Args:
            symbols: List of trading symbols (e.g., 'RELIANCE-EQ', 'INFY-EQ')
        Returns:
            List of instrument tokens
        """
        try:
            instruments = self.kite.instruments('NSE')
            token_map = {inst['tradingsymbol']: inst['exchange_token'] 
                        for inst in instruments}
            return [token_map[symbol] for symbol in symbols]
        except Exception as e:
            print(f"Error getting instrument tokens: {str(e)}")
            return []

    def get_historical_data(self, instrument_token: int, from_date: dt.date, to_date: dt.date, interval: str) -> List[Dict]:
        """
        Get historical data for a given instrument token.
        
        Args:
            instrument_token: Instrument token
            from_date: From date
            to_date: To date
            interval: Time interval (e.g., 'minute', '5minute', 'day')
            
        Returns:
            List of dictionaries with historical data
        """
        try:
            if not self.kite:
                if not self.login():
                    raise Exception("Login failed, cannot fetch historical data.")
            
            return self.kite.historical_data(
                instrument_token=instrument_token,
                from_date=from_date,
                to_date=to_date,
                interval=interval
            )
        except Exception as e:
            logging.error(f"Error getting historical data for token {instrument_token}: {str(e)}")
            return []

    def get_ltps(self, tokens: List[int]) -> Dict[int, float]:
        """
        Get the latest traded prices for multiple instrument tokens efficiently.
        
        Args:
            tokens: List of instrument tokens
        Returns:
            Dict[int, float]: Mapping of token to latest traded price
        """
        if not tokens:
            return {}
            
        try:
            if not self.kite:
                self.login()
                
            # Convert tokens to strings as required by kite.ltp
            token_strs = [str(t) for t in tokens]
            resp = self.kite.ltp(token_strs)
            
            return {int(token): float(data['last_price']) for token, data in resp.items()}
        except Exception as e:
            logging.error(f"Error fetching LTPs: {str(e)}")
            return {}

    def get_ltp(self, token: int) -> float:
        """
        Get the latest traded price for a given instrument token
        
        Args:
            token: Instrument token
        Returns:
            float: Latest traded price or 0 if not found
        """
        token = int(token)
        tick_data = self.token_ltp.get(token, {})
        ltp = tick_data.get('last_price')
        if ltp is not None:
            return ltp

        logging.info(f"LTP for token {token} not found. Subscribing...")

        if token not in self.tokens:
            self.tokens.append(token)
            if self.is_websocket_connected():
                self.kws.subscribe([token])
                self.kws.set_mode(self.kws.MODE_FULL, [token])
                logging.info(f"Subscribed to new token: {token}")
            else:
                logging.info("Websocket not connected. Reconnecting with new token.")
                self.reconnect()
        elif not self.is_websocket_connected():
            self.reconnect()
        
        # Wait for the LTP to arrive
        for _ in range(10):  # Wait up to 2 seconds
            time.sleep(0.2)
            tick_data = self.token_ltp.get(token, {})
            ltp = tick_data.get('last_price')
            if ltp is not None:
                logging.info(f"LTP for {token} received: {ltp}")
                return ltp
                
        logging.warning(f"Could not retrieve LTP for token {token} after subscribing.")
        ltp = self.token_ltp.get(token, {}).get('last_price')
        return ltp if ltp is not None else 0.0

    def get_full_data(self, token: int) -> dict:
        """
        Get the full tick data for a given instrument token
        
        Args:
            token: Instrument token
        Returns:
            dict: Full tick data or empty dict if not found
        """
        return self.token_full_data.get(token, {})

    def on_ticks(self, ws, ticks):
        """
        Process and store complete tick data with instrument_token as key
        """
        try:
            # Store complete tick data for each instrument
            self.token_ltp.update({
                tick['instrument_token']: tick
                for tick in ticks
                if 'instrument_token' in tick
            })
                
        except Exception as e:
            logging.error(f"Error processing tick: {str(e)}")

    def on_connect(self, ws, response):
        try:
            if self.kws and hasattr(self.kws, 'subscribe'):
                self.kws.subscribe(self.tokens)
                self.kws.set_mode(self.kws.MODE_FULL, self.tokens)
                logging.info("Successfully connected to WebSocket")
            else:
                logging.error("WebSocket object is not properly initialized")
        except Exception as e:
            logging.error(f"Error in on_connect: {str(e)}")

    def on_close(self, ws, code, reason):
        logging.info("WebSocket connection closed. Code: {}, Reason: {}".format(code, reason))
        # Reset the WebSocket object to None to force recreation
        self.kws = None
        self.reconnect()

    def on_error(self, ws, code, reason):
        logging.info("Error in WebSocket connection. Code: {}, Reason: {}".format(code, reason))
        # Reset the WebSocket object to None to force recreation
        self.kws = None

    def on_reconnect(self, ws, attempts_count):
        logging.info("Reconnecting: {}".format(attempts_count))

    def on_noreconnect(self, ws):
        logging.info("Unable to reconnect")
        # Reset the WebSocket object to None to force recreation
        self.kws = None

    def subscribe_tokens(self, tokens: List[int]):
        """
        Subscribe to given list of tokens
        """
        try:
            if not self.kite:
                if not self.login():
                    raise Exception("Login failed")

            # Clear existing WebSocket if it exists
            if self.kws:
                try:
                    self.kws.close()
                except:
                    pass
                self.kws = None

            self.kws = KiteTicker(
                api_key=self.credentials['api_key'],
                access_token=self.kite.access_token
            )
            self.tokens += tokens
            self.kws.on_ticks = self.on_ticks
            self.kws.on_connect = self.on_connect
            self.kws.on_close = self.on_close
            self.kws.on_error = self.on_error
            self.kws.on_reconnect = self.on_reconnect
            
            self.kws.connect(threaded=True)
            
            
        except Exception as e:
            logging.error(f"Error in subscribing to tokens: {str(e)}")
            self.kws = None

    def reconnect(self):
        logging.info("Attempting to reconnect websocket...")
        # Optional: wait for a few seconds before attempting to reconnect
        time.sleep(5)
        try:
            # Check if WebSocket object exists and is valid
            if not self.kws or not hasattr(self.kws, 'is_connected'):
                logging.info("Recreating WebSocket connection...")
                self.subscribe_tokens(self.tokens)
            elif not self.kws.is_connected():
                self.kws.connect(threaded=True)
        except Exception as e:
            logging.error(f"Error while reconnecting: {e}")
            # Reset WebSocket object on error
            self.kws = None

    def stop_ticker(self):
        if self.kws and hasattr(self.kws, 'close'):
            try:
                self.kws.close()
                logging.info("WebSocket connection closed")
            except Exception as e:
                logging.error(f"Error closing WebSocket: {e}")
        self.kws = None

    def is_websocket_connected(self) -> bool:
        """
        Check if WebSocket is properly connected
        """
        try:
            return (self.kws is not None and 
                    hasattr(self.kws, 'is_connected') and 
                    self.kws.is_connected())
        except:
            return False

    def add_subscription(self, tokens: List[int]):
        """Add new tokens to the subscription list without reconnecting."""
        new_tokens = [t for t in tokens if t not in self.tokens]
        if not new_tokens:
            logging.debug(f"Tokens {tokens} already subscribed.")
            return

        self.tokens.extend(new_tokens)
        if self.is_websocket_connected():
            self.kws.subscribe(new_tokens)
            self.kws.set_mode(self.kws.MODE_FULL, new_tokens)
            logging.info(f"Subscribed to new tokens: {new_tokens}")
        else:
            logging.warning("Websocket not connected. New tokens will be subscribed upon reconnection.")

    def safe_websocket_operation(self, operation_func, *args, **kwargs):
        """
        Safely execute WebSocket operations with proper error handling
        """
        try:
            if not self.is_websocket_connected():
                logging.warning("WebSocket not connected, attempting to reconnect...")
                self.reconnect()
                # Wait a bit for connection to establish
                time.sleep(2)
                
            if self.is_websocket_connected():
                return operation_func(*args, **kwargs)
            else:
                logging.error("WebSocket connection failed to establish")
                return None
        except Exception as e:
            logging.error(f"Error in WebSocket operation: {str(e)}")
            # Reset WebSocket on error
            self.kws = None
            return None

    def force_reconnect(self):
        """
        Force a complete WebSocket reconnection
        """
        logging.info("Forcing WebSocket reconnection...")
        try:
            if self.kws:
                try:
                    self.kws.close()
                except:
                    pass
            self.kws = None
            time.sleep(2)
            self.subscribe_tokens(self.tokens)
        except Exception as e:
            logging.error(f"Error in force reconnection: {e}")
            self.kws = None
