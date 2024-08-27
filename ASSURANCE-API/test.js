const express = require('express');
const session = require('express-session'); // npm install express-session
const Keycloak = require('keycloak-connect'); // npm install keycloak-connect

const keycloakConfig = require('./keycloak.json');

const app = express();

const port = 3000;

const memoryStore = new session.MemoryStore();

const keycloak = new Keycloak({ store: memoryStore }); // Changed 'keycloak' to 'Keycloak' and reused the 'keycloak' instance below

app.use(session({
    secret: 'TQ3wAjQpv2JuYzJFNTPbKp8DrNkeYmWU',
    resave: false,
    saveUninitialized: true,
    store: memoryStore
}));

app.use(keycloak.middleware());

// vérifier le rôle de l'utilisateur
function checkRole(role) {
    return function (req, res, next) {
        if (!req.kauth.grant) {
            return res.status(403).send('Forbidden'); // Ensure the grant object exists
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
    <button style="background-color: #007bff; color:#fff;" onclick="window.location.href='http://localhost:3000/login/ec2lt'">Ec2lt</button>
    <button style="background-color: blue; color:#fff;" onclick="window.location.href='http://localhost:3000/login/rtn'">RTN</button>
    `);
});

// connexion à l'API en fonction du rôle de l'utilisateur
app.get('/login/:role', keycloak.protect(), (req, res, next) => {
    const role = req.params.role;
    const roleCheckMiddleware = checkRole(role);
    roleCheckMiddleware(req, res, async () => {
        try {
            const username = req.kauth.grant.access_token.content.preferred_username;
            res.send(`
            <h1 style="color: #007bff;">Votre espace est ${role}</h1>
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
app.post('/logout', keycloak.protect(), (req, res) => {
    req.kauth.grant.unstore(req, res); // Déconnexion de Keycloak
    res.redirect('/'); // Rediriger vers la page d'accueil
});

// Démarrer le serveur
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
