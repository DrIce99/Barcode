const { google } = require("googleapis");

// 1. Inserisci qui le tue credenziali del Passo 4
const CLIENT_ID = "241581605580-u1opn4tb5imnt4dfr4655m5q7ubd6bml.apps.googleusercontent.com";
const CLIENT_SECRET = "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";

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    "http://localhost"
);

// 2. Incolla qui dentro il codice lunghissimo che hai copiato al Passo 6
// (Attenzione: prendi solo la parte DOPO "code=" e PRIMA di eventuali "&scope=")
const CODICE_DA_PASSO_6 = "4/0AdkVLPwcIGT5swFCf4tJYXkW92Wl0lEASV3a884JRCLniq32dQxbJIZNUjBGxEH151WA9g&scope=https://www.googleapis.com/auth/drive";

async function generaRefreshToken() {
    try {
        console.log("Scambio del codice con i token in corso...");
        
        // Richiesta effettiva a Google
        const { tokens } = await oauth2Client.getToken(CODICE_DA_PASSO_6);
        
        console.log("\n✅ OPERAZIONE COMPLETATA CON SUCCESSO!");
        console.log("=========================================");
        console.log(JSON.stringify(tokens, null, 2));
        console.log("=========================================");
        console.log("\nCopia il 'refresh_token' che vedi qui sopra e salvalo bene.");

    } catch (error) {
        console.error("❌ Errore durante lo scambio del codice:", error.message);
    }
}

generaRefreshToken();