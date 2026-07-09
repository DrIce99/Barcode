export const ScannerService = {
    async scansiona() {
        // Fallback di sicurezza se la libreria non si carica (es. offline totale su PC)
        if (typeof Html5Qrcode === 'undefined') {
            console.warn("Libreria html5-qrcode non trovata. Uso prompt di simulazione.");
            return prompt("Codice simulato:", "800123456");
        }

        return new Promise((resolve) => {
            const container = document.getElementById('scanner-container');
            const btnStop = document.getElementById('btn-stop-scanner');
            
            // Mostra l'interfaccia nera a schermo intero
            container.style.display = 'flex';

            // Inizializza l'istanza dello scanner sul div dell'HTML
            const html5QrCode = new Html5Qrcode("qr-reader");
            
            // Configurazione dello scanner (inquadratura)
            const config = { 
                fps: 10, 
                qrbox: { width: 280, height: 150 } // Rettangolo di lettura per i codici a barre lineari
            };

            // Funzione eseguita quando viene rilevato un codice
            const onSuccess = (decodedText) => {
                html5QrCode.stop().then(() => {
                    container.style.display = 'none';
                    resolve(decodedText);
                }).catch(err => console.error("Errore spegnimento fotocamera:", err));
            };

            // Funzione eseguita a ogni frame vuoto (la ignoriamo)
            const onFailure = (err) => {};

            // Avvia la fotocamera posteriore ("environment")
            html5QrCode.start({ facingMode: "environment" }, config, onSuccess, onFailure)
                .catch(err => {
                    console.error("Impossibile avviare la fotocamera:", err);
                    alert("Errore fotocamera: " + err);
                    container.style.display = 'none';
                    resolve(null);
                });

            // Gestione del tasto "Annulla"
            btnStop.onclick = () => {
                html5QrCode.stop().then(() => {
                    container.style.display = 'none';
                    resolve(null);
                }).catch(() => {
                    container.style.display = 'none';
                    resolve(null);
                });
            };
        });
    }
};