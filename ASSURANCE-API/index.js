const express = require('express');
const session = require('express-session'); // npm install express-session
const Keycloak = require('keycloak-connect'); // npm install keycloak-connect

// Import configurations for each realm
const mobilebankConfig = require('./mobilebank-keycloak.json');
const piggybankConfig = require('./piggybank-keycloak.json');

const app = express();
const port = 3000;

const memoryStore = new session.MemoryStore();

app.use(session({
    secret: 'N27pEjEvmzzALDkyF9cbxWgXi7Ux1TMq',
    resave: false,
    saveUninitialized: true,
    store: memoryStore
}));

// Initialize Keycloak instances for each realm
const mobilebankKeycloak = new Keycloak({ store: memoryStore }, mobilebankConfig);
const piggybankKeycloak = new Keycloak({ store: memoryStore }, piggybankConfig);

// Use Keycloak middleware for each realm
app.use(mobilebankKeycloak.middleware({ logout: '/logout' }));
app.use(piggybankKeycloak.middleware({ logout: '/logout' }));

// Vérifier le rôle de l'utilisateur pour un realm spécifique
function checkRole(realmKeycloak, role) {
    return function (req, res, next) {
        if (!req.kauth.grant) {
            return res.status(403).send('Forbidden');
        }

        const accessToken = req.kauth.grant.access_token.token;
        const username = req.kauth.grant.access_token.content.preferred_username;
        const userRoles = req.kauth.grant.access_token.content.realm_access.roles;

        if (userRoles.includes(role)) {
            next(); // Le role est correct, continuez
        } else {
            res.status(403).send('Forbidden'); // Le role n'est pas correct, refuser l'accès
        }
    }
}

app.get('/', (req, res) => {
    res.send(`
    <button style="background-color: #007bff; color:#fff;" onclick="window.location.href='http://localhost:3000/login/mobilebank'">MobileBank</button>
    <button style="background-color: blue; color:#fff;" onclick="window.location.href='http://localhost:3000/login/piggybank'">PiggyBank</button>
    `);
});

// Route for MobileBank realm
app.get('/login/mobilebank', mobilebankKeycloak.protect(), (req, res, next) => {
    const roleCheckMiddleware = checkRole(mobilebankKeycloak, 'mobilebank');
    roleCheckMiddleware(req, res, async () => {
        try {
            const username = req.kauth.grant.access_token.content.preferred_username;
            res.send(`
            <h1 style="color: #007bff;">Welcome to MobileBank</h1>
            <p style="color:green;">Bienvenue ${username}</p>
            <form action="/logout" method="post">
                <button type="submit" style="background-color: blue; color:#fff;">Logout</button>
            </form>
            `);
        } catch (error) {
            console.error('Error:', error);
            res.status(500).send('Internal server error.');
        }
    });
});

// Route for PiggyBank realm
app.get('/login/piggybank', piggybankKeycloak.protect(), (req, res, next) => {
    const roleCheckMiddleware = checkRole(piggybankKeycloak, 'piggybank');
    roleCheckMiddleware(req, res, async () => {
        try {
            const username = req.kauth.grant.access_token.content.preferred_username;
            res.send(`
            <h1 style="color: #007bff;">Welcome to PiggyBank</h1>
            <p style="color:green;">Bienvenue ${username}</p>
            <form action="/logout" method="post">
                <button type="submit" style="background-color: blue; color:#fff;">Logout</button>
            </form>
            `);
        } catch (error) {
            console.error('Error:', error);
            res.status(500).send('Internal server error.');
        }
    });
});

// Déconnexion
app.post('/logout', (req, res) => {
    if (req.kauth.grant) {
        req.kauth.grant.unstore(req, res); // Déconnexion de Keycloak
    }
    res.redirect('/'); // Rediriger vers la page d'accueil
});

// Démarrer le serveur
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
