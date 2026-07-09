const getPreferences = () => window.Capacitor?.Plugins?.Preferences;
const getGoogleSignIn = () => window.Capacitor?.Plugins?.GoogleSignIn;

const GOOGLE_CLIENT_ID = "169831826299-5892ag9cb5c4dqqco3emlr7tep87itjf.apps.googleusercontent.com";

export const DriveService = {
    accessToken: null,
    isInitialized: false,
    
    // Cache per evitare chiamate ripetitive a Drive nello stesso utilizzo
    packingListsFolderId: null,
    currentBarcodeFolderId: null,
    currentBarcode: null,

    async assicuraInizializzazione() {
        if (this.isInitialized) return;
        const googlePlugin = getGoogleSignIn();
        if (googlePlugin) {
            await googlePlugin.initialize({
                clientId: GOOGLE_CLIENT_ID,
                scopes: ['https://www.googleapis.com/auth/drive.file']
            });
            this.isInitialized = true;
            console.log("[Drive] Plugin Google Sign-In inizializzato correttamente.");
        }
    },

    async tentaLoginSilenzioso() {
        await this.assicuraInizializzazione();
        if (!getPreferences()) return false;
        
        const { value: savedToken } = await getPreferences().get({ key: 'google_access_token' });
        if (savedToken) {
            this.accessToken = savedToken;
            console.log("[Drive] Sessione Google Drive recuperata.");
            return true;
        }
        return false;
    },

    async loginManuale() {
        try {
            const googlePlugin = getGoogleSignIn();
            
            if (!googlePlugin) {
                console.log("[Drive Mock] Simulazione login su PC");
                this.accessToken = "MOCK_TOKEN_PC";
                return true;
            }

            await this.assicuraInizializzazione();
            const risultato = await googlePlugin.signIn();
            const googleToken = risultato.authentication?.accessToken || risultato.accessToken;

            if (!googleToken) {
                throw new Error("Impossibile recuperare l'Access Token di Google.");
            }

            this.accessToken = googleToken;

            if (getPreferences()) {
                await getPreferences().set({ key: 'google_access_token', value: googleToken });
            }

            return true;
        } catch (error) {
            console.error("[Drive] Errore durante il login Google nativo:", error);
            throw error;
        }
    },

    // FUNZIONE DI SUPPORTO: Cerca una cartella o la crea se non esiste
    async trovaOCreaCartellaPura(nomeCartella, parentId = null) {
        let query = `name = '${nomeCartella}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        if (parentId) {
            query += ` and '${parentId}' in parents`;
        }
        
        // 1. Cerca se la cartella esiste già
        const cercaRisposta = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${this.accessToken}` }
        });
        
        if (!cercaRisposta.ok) throw new Error(`Impossibile verificare esistenza cartella: ${nomeCartella}`);
        const cercaDati = await cercaRisposta.json();
        
        if (cercaDati.files && cercaDati.files.length > 0) {
            return cercaDati.files[0].id; // Trovata! Ritorna l'ID esistente
        }
        
        // 2. Se non esiste, la crea da zero
        const metaCartella = {
            name: nomeCartella,
            mimeType: 'application/vnd.google-apps.folder'
        };
        if (parentId) {
            metaCartella.parents = [parentId];
        }
        
        const creaRisposta = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metaCartella)
        });
        
        if (!creaRisposta.ok) throw new Error(`Errore durante la creazione automatica della cartella: ${nomeCartella}`);
        const creaDati = await creaRisposta.json();
        return creaDati.id;
    },

    //   Gestisce l'albero delle cartelle ("Packing Lists" -> "Codice_Barcode")
    async assicuraStrutturaCartelle(barcode) {
        // Genera o recupera la cartella principale madre "Packing Lists"
        if (!this.packingListsFolderId) {
            this.packingListsFolderId = await this.trovaOCreaCartellaPura("Packing Lists");
        }
        
        // Genera o recupera la sottocartella specifica del Barcode attuale
        if (this.currentBarcode !== barcode || !this.currentBarcodeFolderId) {
            this.currentBarcodeFolderId = await this.trovaOCreaCartellaPura(barcode, this.packingListsFolderId);
            this.currentBarcode = barcode;
        }
        
        return this.currentBarcodeFolderId;
    },

    // Carica la foto direttamente nella sottocartella corretta
    async caricaFoto(base64Data, nomeFile, barcode) {
        if (!this.accessToken) throw new Error("Nessun account Google configurato.");

        // Recupera l'ID della cartella di destinazione (creandola se necessario)
        const folderId = await this.assicuraStrutturaCartelle(barcode);

        // Inseriamo l'ID della cartella nei metadati del file ("parents")
        const metadata = { 
            name: nomeFile, 
            mimeType: 'image/jpeg', 
            description: `Barcode: ${barcode}`,
            parents: [folderId] //   Caricamento mirato nella sottocartella!
        };

        const boundary = 'foo_bar_boundary';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const multipartRequestBody =
            delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) +
            delimiter + 'Content-Type: image/jpeg\r\n' + 'Content-Transfer-Encoding: base64\r\n\r\n' +
            base64Data + closeDelimiter;

        const risposta = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: multipartRequestBody
        });

        if (!risposta.ok) {
            const dettagliErrore = await risposta.text();
            throw new Error(`Errore Drive: ${dettagliErrore}`);
        }
        return await risposta.json();
    }
};