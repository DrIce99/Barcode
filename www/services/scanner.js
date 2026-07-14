const getScreenOrientation = () => window.Capacitor?.Plugins?.ScreenOrientation;

export const ScannerService = {
    async scansiona() {
        // Fallback di sicurezza se la libreria non si carica (es. offline totale su PC)
        if (typeof Html5Qrcode === 'undefined') {
            console.warn("Libreria html5-qrcode non trovata. Uso prompt di simulazione.");
            return prompt("Codice simulato:", "800123456");
        }

        // Blocco rotazione schermo quando si inquadra barcode
        if (getScreenOrientation()) {
            try {
                await getScreenOrientation().lock({ orientation: 'portrait' });
                console.log("[Scanner] Orientamento bloccato in Portrait.");
            } catch (err) {
                console.error("[Scanner] Impossibile bloccare l'orientamento:", err);
            }
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

            const sbloccaERisolvi = async (risultato) => {
                if (getScreenOrientation()) {
                    try {
                        await getScreenOrientation().unlock();
                        console.log("[Scanner] Orientamento sbloccato. Ripristinata rotazione di sistema.");
                    } catch (err) {
                        console.error("[Scanner] Errore durante lo sblocco dello schermo:", err);
                    }
                }
                resolve(risultato);
            };

            // Funzione eseguita quando viene rilevato un codice
            const onSuccess = (decodedText) => {
                html5QrCode.stop().then(() => {
                    container.style.display = 'none';
                    sbloccaERisolvi(decodedText);
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
                    sbloccaERisolvi(null);
                });

            // Gestione del tasto "Annulla"
            btnStop.onclick = () => {
                html5QrCode.stop().then(() => {
                    container.style.display = 'none';
                    sbloccaERisolvi(null);
                }).catch(() => {
                    container.style.display = 'none';
                    sbloccaERisolvi(null);
                });
            };
        });
    }
};