// Cambia questo indirizzo con l'IP del tuo computer se testi dal telefono reale!
const BACKEND_URL = "http://10.38.106.51:3000"; 

export const ApiService = {
    async login() {
        // Ora l'app non ha bisogno di fare nulla all'avvio perché il server è già autenticato!
        return { status: 'authenticated' };
    },

    async createFolder(barcode) {
        // Diventa una funzione leggera: serve solo a validare lo stato, 
        // la creazione fisica avviene atomicamente durante l'upload.
        return { folderId: barcode }; 
    },

    async uploadPhoto(base64Data, barcode, currentCount) {
        // Inviamo barcode e foto in un'unica richiesta come concordato
        const risposta = await fetch(`${BACKEND_URL}/api/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                barcode: barcode,
                imageBase64: base64Data
            })
        });

        if (!risposta.ok) {
            throw new Error("Errore del server durante l'upload.");
        }

        const dati = await risposta.json();
        
        // Aggiorna al volo l'ID reale della cartella nella sessione per il tasto "Fine"
        if (dati.folderId) {
            window.idCartellaDriveReale = dati.folderId; 
        }

        return {
            success: dati.success,
            filename: dati.filename
        };
    }
};