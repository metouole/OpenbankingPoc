require('dotenv').config();
const express = require('express');
const session = require('express-session');
const Keycloak = require('keycloak-connect');
const axios = require('axios');
const cors = require('cors');
const { Issuer, custom } = require('openid-client');

const app = express();


// Configure CORS
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));


const memoryStore = new session.MemoryStore();

const config = {
  sessionSecret: process.env.SESSION_SECRET || 'default_secret',
  keycloakUrl: process.env.KEYCLOAK_URL,
};

app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: true,
  store: memoryStore,
  cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true }
}));

app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

function createKeycloakInstance(realm) {
  const envKey = realm.toUpperCase();
  const config = {
    realm: realm,
    'auth-server-url': process.env[`${envKey}_AUTH_URL`],
    'ssl-required': 'external',
    resource: process.env[`${envKey}_CLIENT_ID`],
    'confidential-port': 0,
    'public-client': false,
    credentials: {
      secret: process.env[`${envKey}_CLIENT_SECRET`]
    }
  };
  console.log(`Keycloak config for ${realm}:`, config);
  return new Keycloak({ store: memoryStore }, config);
}

const realmInstances = {
  mobilebank: createKeycloakInstance('mobilebank'),
  piggybank: createKeycloakInstance('piggybank'),
  assurance: createKeycloakInstance('assurance'),
  microfinance: createKeycloakInstance('microfinance')
};

// Keycloak middleware
Object.values(realmInstances).forEach(keycloak => {
  app.use(keycloak.middleware({
    logout: '/logout',
    admin: '/'
  }));
});

function protectRoute(req, res, next) {
  const realm = req.query.realm || 'mobilebank';
  const keycloak = realmInstances[realm];
  if (!keycloak) {
    return res.status(403).json({ message: 'Invalid realm specified' });
  }
  return keycloak.protect()(req, res, next);
}

function renderIndexPage(res, realm, authenticated = false, user = null, token = null) {
  res.render('index1', { 
    realm,
    authenticated,
    user,
    token
  });
}

// Increase HTTP request timeout
custom.setHttpOptionsDefaults({
  timeout: 15000,
});

app.get('/', async (req, res, next) => {
  const realm = req.query.realm || 'mobilebank';
  const keycloak = realmInstances[realm];

  if (!keycloak) {
    return res.status(400).send('Invalid realm specified');
  }

  console.log('Incoming request to root:', req.url);
  console.log('Query parameters:', req.query);

  if (req.query.code) {
    try {
      const issuer = await Issuer.discover(`${keycloak.config.authServerUrl}/realms/${realm}`);
      const client = new issuer.Client({
        client_id: keycloak.config.clientId,
        client_secret: keycloak.config.secret,
        redirect_uris: [`${req.protocol}://${req.headers.host}${req.path}`],
        response_types: ['code'],
      });

      client[custom.clock_tolerance] = 5 * 60;
      client[custom.realm_access] = true;

      const params = client.callbackParams(req);
      const tokenSet = await client.callback(
        `${req.protocol}://${req.headers.host}${req.path}`,
        params,
        { state: req.query.state }
      );

      //console.log('Received and validated tokens %j', tokenSet);
      //console.log('Validated ID Token claims %j', tokenSet.claims());

      req.session.tokenSet = tokenSet;

      renderIndexPage(res, realm, true, tokenSet.claims(), tokenSet.access_token);
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      console.error('Error details:', error.error_description || error.message);
      renderIndexPage(res, realm);
    }
  } else {
    // This is a regular request
    if (req.session.tokenSet) {
      renderIndexPage(res, realm, true, req.session.tokenSet.claims(), req.session.tokenSet.access_token);
    } else {
      renderIndexPage(res, realm);
    }
  }
});

app.get('/login', (req, res) => {
  const realm = req.query.realm || 'mobilebank';
  const keycloak = realmInstances[realm];
  const redirectUri = encodeURIComponent(`${req.protocol}://${req.get('host')}/`);
  console.log('Redirect URI:', redirectUri);
  
  const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  const loginUrl = `${keycloak.config.realmUrl}/protocol/openid-connect/auth?` +
    `client_id=${keycloak.config.clientId}` +
    `&state=${state}` +
    `&redirect_uri=${redirectUri}` +
    `&scope=openid` +
    `&response_type=code`;

  console.log('Generated Login URL:', loginUrl);
  res.redirect(loginUrl);
});

app.get('/fetch-data',  async (req, res) => {
  try {
    //const token = req.kauth.grant.access_token.token;
    console.log("trying to call flask api")
   /* const response = await axios.get('http://127.0.0.1:5000/customers_identity', {
      headers: { 'Authorization': `Bearer ${token}` }
    });*/
    const response = await axios.get('http://127.0.0.1:5000/customers_identity');
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ message: 'Error fetching customer data' });
  }
});



app.get('/fetch-transaction-history', protectRoute, async (req, res) => {
  try {
    const token = req.kauth.grant.access_token.token;
    const response = await axios.get('http://127.0.0.1:5000/transactions_history', {
      headers: { 'Authorization': `Bearer ${token}` },

    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    res.status(500).json({ message: 'Error fetching transaction history' });
  }
});

app.put('/initiate-transaction', protectRoute, async (req, res) => {
  try {
    const token = req.kauth.grant.access_token.token;
    const { id, amount } = req.body;
    const response = await axios.put(`http://127.0.0.1:5000/paiement_initiation/${id}/${amount}`, {}, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error initiating transaction:', error);
    res.status(500).json({ message: 'Error initiating transaction' });
  }
});

app.get('/logout', (req, res) => {
  const realm = req.query.realm || 'mobilebank';
  const keycloak = realmInstances[realm];
  
  if (!keycloak) {
    return res.status(400).send('Invalid realm specified');
  }

  // Clear the session first
  req.session.destroy(err => {
    if (err) {
      console.error('Failed to destroy session:', err);
    }

    // Construct the Keycloak logout URL
    const logoutUrl = `${keycloak.config['auth-server-url']}/realms/${realm}/protocol/openid-connect/logout`;
    const redirectUri = encodeURIComponent(`${req.protocol}://${req.get('host')}/?state=logged-out`);
    
    // Redirect to Keycloak's logout endpoint
    res.redirect(`${logoutUrl}?redirect_uri=${redirectUri}`);
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  console.error('Stack:', err.stack);
  res.status(500).send('An error occurred: ' + err.message);
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});