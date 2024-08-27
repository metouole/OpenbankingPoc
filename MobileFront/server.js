const express = require('express');
const session = require('express-session');
const Keycloak = require('keycloak-connect');
const ejs = require('ejs');
const axios = require('axios');

const app = express();
const memoryStore = new session.MemoryStore();

// Keycloak configuration
const keycloak = new Keycloak({ store: memoryStore });

// Middleware setup
app.use(session({
  secret: 'QjHzoZaYt5Ex0AdB0r834D1gHM6YjDlz',
  resave: false,
  saveUninitialized: true,
  store: memoryStore
}));
app.use(keycloak.middleware());

// Middleware to parse JSON body
app.use(express.json());

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Serve static files
app.use(express.static('public'));

// Route to render the main page
app.get('/', (req, res) => {
  const user = req.kauth.grant ? req.kauth.grant.access_token.content : null;
  const token = req.kauth.grant ? req.kauth.grant.access_token.token : null;
  res.render('index', { user, token });
});

// Route to handle login for specific realms
app.get('/login', (req, res) => {
  const realm = req.query.realm || 'default-realm';
  const redirectUri = 'http://localhost:3000'; // Adjust to your frontend URL
  res.redirect(`/realms/${realm}/protocol/openid-connect/auth?client_id=your-client-id&redirect_uri=${redirectUri}`);
});

// Route to fetch customer data
app.get('/fetch-data', keycloak.protect(), async (req, res) => {
  try {
    const token = req.kauth.grant.access_token.token;
    const response = await axios.get('http://127.0.0.1:5000/customers_identity', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).send('Error fetching customer data from API');
  }
});

// Route to fetch transaction history
app.get('/fetch-transaction-history', keycloak.protect(), async (req, res) => {
  try {
    const token = req.kauth.grant.access_token.token;
    const response = await axios.get('http://127.0.0.1:5000/transactions_history', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).send('Error fetching transaction history from API');
  }
});

// Route to initiate a transaction
app.put('/initiate-transaction', keycloak.protect(), async (req, res) => {
  try {
    const token = req.kauth.grant.access_token.token;
    const { id, amount } = req.body;
    const response = await axios.put(`http://127.0.0.1:5000/paiement_initiation/${id}/${amount}`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).send('Error initiating transaction');
  }
});

// Route to handle logout for specific realms
app.get('/logout', (req, res) => {
  const realm = req.query.realm || 'default-realm';
  const logoutUrl = `http://localhost:8181/realms/${realm}/protocol/openid-connect/logout?redirect_uri=http://localhost:3000`;
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Error destroying session');
    }
    res.redirect(logoutUrl);
  });
});

// Start the server
app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
