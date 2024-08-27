const express = require('express');
const session = require('express-session');
const Keycloak = require('keycloak-connect');

// Import a base configuration
const keycloakConfig = require('./keycloak1.json');

const app = express();
const port = 3000;

const memoryStore = new session.MemoryStore();

app.use(session({
    secret: 'N27pEjEvmzzALDkyF9cbxWgXi7Ux1TMq',
    resave: false,
    saveUninitialized: true,
    store: memoryStore
}));

// Initialize a single Keycloak instance with a base configuration
const keycloak = new Keycloak({ store: memoryStore }, keycloakConfig);
app.use(keycloak.middleware({ logout: '/logout' }));

// Middleware to set the realm dynamically
function setDynamicRealm(req, res, next) {
    const requestedRealm = req.params.realm; // Capture realm from request params
    console.log(`Received request for realm: ${requestedRealm}`); // Debug log

    if (requestedRealm) {
        // Create a copy of the base Keycloak config and update the realm
        const dynamicConfig = { ...keycloakConfig, realm: requestedRealm };
        keycloak.config = dynamicConfig; // Set the new config in Keycloak
    } else {
        console.log('No realm specified or invalid realm');
        return res.status(400).send('Realm not specified or invalid'); // Handle the error gracefully
    }

    next();
}

// Check user role for a specific realm
function checkRole(role) {
    return function (req, res, next) {
        if (!req.kauth.grant) {
            return res.status(403).send('Forbidden');
        }

        const userRoles = req.kauth.grant.access_token.content.realm_access.roles;

        if (userRoles.includes(role)) {
            next(); // Role is correct, continue
        } else {
            res.status(403).send('Forbidden'); // Role is incorrect, deny access
        }
    };
}

app.get('/', (req, res) => {
    res.send(`
    <button style="background-color: #007bff; color:#fff;" onclick="window.location.href='http://localhost:3000/login/mobilebank'">MobileBank</button>
    <button style="background-color: blue; color:#fff;" onclick="window.location.href='http://localhost:3000/login/piggybank'">PiggyBank</button>
    `);
});

// Use route handlers with logging
app.get('/login/:realm', setDynamicRealm, keycloak.protect(), (req, res) => {
    const roleCheckMiddleware = checkRole(req.params.realm);
    
    roleCheckMiddleware(req, res, (err) => {
        if (err) {
            console.error('Error:', err);
            return res.status(500).send('Internal server error.');
        }
        
        const username = req.kauth.grant.access_token.content.preferred_username;
        console.log(`User ${username} authenticated for realm: ${req.params.realm}`); // Debug log
        res.send(`
        <h1 style="color: #007bff;">Welcome to ${req.params.realm}</h1>
        <p style="color:green;">Bienvenue ${username}</p>
        <form action="/logout" method="post">
            <button type="submit" style="background-color: blue; color:#fff;">Logout</button>
        </form>
        `);
    });
});

// Déconnexion
app.post('/logout', (req, res) => {
    if (req.kauth.grant) {
        req.kauth.grant.unstore(req, res); // Disconnect from Keycloak
    }
    res.redirect('/');
}
);
// Démarrer le serveur
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});