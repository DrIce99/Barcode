// www/app.js

import { ScannerService } from './services/scanner.js';
import { CameraService } from './services/camera.js';
import { DriveService } from './services/drive.js';
import { Popup } from './services/popup.js';
import { StorageService } from './services/storage.js';

const getPreferences = () => window.Capacitor?.Plugins?.Preferences;

const STATI = {
    LOGIN_GOOGLE: '#view-auth',
    ATTESA_SCAN: '#view-scan',
    SESSIONE_FOTO: '#view-session'
};

let statoAttuale = null;
let sessioneAttiva = null;

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    configuraListenerBottoni();
    inizializzaIndicatoreConnessione();

    try {
        const { LocalNotifications } = window.Capacitor.Plugins;
        if (LocalNotifications) {
            const permessi = await LocalNotifications.checkPermissions();
            if (permessi.display !== 'granted') {
                await LocalNotifications.requestPermissions();
            }
        }
    } catch (e) {
        console.warn("Impossibile richiedere i permessi di notifica:", e);
    }

    await StorageService.inizializza();

    document.getElementById('btn-google-login')?.addEventListener('click', gestioneLoginManuale);

    const giaAutenticato = await DriveService.tentaLoginSilenzioso();

    if (giaAutenticato) {
        //   RISOLUZIONE BUG SOVRAPPOSIZIONE: Nascondiamo esplicitamente la vista di login iniziale
        const loginView = document.querySelector(STATI.LOGIN_GOOGLE);
        if (loginView) {
            loginView.style.display = 'none';
            loginView.style.opacity = 0;
        }

        statoAttuale = STATI.ATTESA_SCAN;
        const startView = document.querySelector(STATI.ATTESA_SCAN);
        if (startView) {
            startView.style.display = 'block';
            startView.style.opacity = 1;
        }

        await controllaESincronizzaFotoPendenti();
    } else {
        statoAttuale = STATI.LOGIN_GOOGLE;
        transizioneA(STATI.LOGIN_GOOGLE);
    }    
}

function configuraListenerBottoni() {
    document.getElementById('btn-scan').addEventListener('click', gestioneScansione);
    document.getElementById('btn-take-photo').addEventListener('click', gestioneScattoFoto);
    document.getElementById('btn-end-session').addEventListener('click', gestioneChiusuraSessione);
    document.getElementById('btn-manual-scan').addEventListener('click', gestioneScansioneManuale);
}

function avviaSessione(barcode) {
    const cleanBarcode = barcode.trim().replace(/\s+/g, '');
    
    if (!cleanBarcode) {
        Popup.alert("Errore", "Il codice inserito non è valido.");
        return;
    }

    sessioneAttiva = {
        barcode: cleanBarcode,
        fotoCaricate: 0,
        fotoLocali: 0
    };
    
    document.getElementById('session-barcode').innerText = sessioneAttiva.barcode;
    document.getElementById('status-count').innerText = "0";
    document.getElementById('status-last-file').innerText = "Nessuno";
    transizioneA(STATI.SESSIONE_FOTO);
}

async function gestioneLoginManuale() {
    try {
        const successo = await DriveService.loginManuale();
        if (successo) {
            transizioneA(STATI.ATTESA_SCAN);
        } else {
            Popup.alert("Errore", "Login annullato o fallito.");
        }
    } catch (error) {
        Popup.alert("Errore Login", error.message);
    }
}

async function gestioneScansione() {
    try {
        const barcode = await ScannerService.scansiona();
        if (!barcode) return;
        avviaSessione(barcode);
    } catch (error) {
        Popup.alert("Errore", error.message);
    }
}

function gestioneScansioneManuale() {
    const inputEl = document.getElementById('input-manual-barcode');
    const codice = inputEl.value;
    
    if (codice && codice.trim() !== '') {
        avviaSessione(codice);
        inputEl.value = ''; // Svuota l'input dopo l'uso per la prossima volta
    } else {
        Popup.alert("Attenzione", "Inserisci un codice packing list valido.");
    }
}

async function gestioneScattoFoto() {
    if (!sessioneAttiva) return;

    const btnScatta = document.getElementById('btn-take-photo');
    const uploaderBox = document.getElementById('session-uploader');

    let base64Data = null;

    // Acquisizione singola dello scatto
    try {
        base64Data = await CameraService.catturaScatto();
        if (!base64Data) return;
    } catch (cameraErr) {
        console.log("Scatto annullato dall'utente:", cameraErr);
        return;
    }

    // Salvataggio immediato in locale
    try {
        btnScatta.disabled = true;
        uploaderBox.style.display = 'block';
        document.getElementById('uploader-text').innerText = "Scrittura file in locale...";

        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}-${String(now.getMilliseconds()).padStart(3, '0')}`;
        const nomeFile = `${sessioneAttiva.barcode}_${timestamp}.jpg`;
        
        await StorageService.creaCartellaBarcode(sessioneAttiva.barcode);
        const salvataggioLocale = await StorageService.salvaFotoLocale(base64Data, sessioneAttiva.barcode, nomeFile);

        // Incrementiamo e aggiorniamo lo stato dell'app
        sessioneAttiva.fotoCaricate++;
        document.getElementById('status-count').innerText = sessioneAttiva.fotoCaricate;
        document.getElementById('status-last-file').innerText = salvataggioLocale.filename;
        Popup.toast("Foto salvata localmente");
    } catch (localErr) {
        Popup.alert("Errore Scrittura", "Impossibile salvare il file nel dispositivo: " + localErr.message);
    } finally {
        btnScatta.disabled = false;
        uploaderBox.style.display = 'none';
    }
}

async function gestioneAnnullaSessione() {
    const conferma = await Popup.confirm("Annulla Sessione", "Vuoi uscire? Le foto inviate rimarranno comunque salvate su Drive.");
    if (!conferma) return;

    sessioneAttiva = null;
    Popup.toast("Sessione chiusa");
    transizioneA(STATI.ATTESA_SCAN);
}

async function gestioneChiusuraSessione() {
    Popup.toast("Sincronizzazione sessione avviata...");

    const esitoSync = await sincronizzaTuttiIPendenti();

    if (esitoSync) {
        if (getPreferences()) await getPreferences().set({ key: 'sync_check', value: 'true' });
        await Popup.alert("Sessione Completata", `Tutte le ${sessioneAttiva.fotoCaricate} foto sono al sicuro sul telefono e caricate su Google Drive.`);
    } else {
        if (getPreferences()) await getPreferences().set({ key: 'sync_check', value: 'false' });
        await Popup.alert("Sessione Salvata (Offline)", `Le foto (${sessioneAttiva.fotoCaricate}) sono salvate sul telefono. La sincronizzazione verrà completata in background ogni 15 minuti.`);
    }

    sessioneAttiva = null;
    transizioneA(STATI.ATTESA_SCAN);
}

function transizioneA(nuovoStato) {
    const elementoUscita = statoAttuale;
    statoAttuale = nuovoStato;

    const elUscita = document.querySelector(elementoUscita);
    const elEntrata = document.querySelector(nuovoStato);

    if (!elEntrata) {
        alert(`[Errore di ID] L'app sta provando a mostrare la schermata "${nuovoStato}", ma questo ID non esiste nel tuo file index.html!`);
        return;
    }

    if (elUscita) {
        anime({
            targets: elementoUscita,
            opacity: 0,
            translateY: -20,
            duration: 200,
            easing: 'easeInQuad',
            complete: () => {
                elUscita.style.display = 'none';
                elEntrata.style.display = 'block';
                
                anime({
                    targets: nuovoStato,
                    opacity: [0, 1],
                    translateY: [20, 0],
                    duration: 250,
                    easing: 'easeOutQuad'
                });
            }
        });
    } else {
        elEntrata.style.display = 'block';
        elEntrata.style.opacity = 1;
    }
}

async function controllaESincronizzaFotoPendenti(forzaEsecuzione = false) {
    // 1. Se stiamo forzando l'esecuzione (es. al ritorno della rete), ignoriamo navigator.onLine
    if (!forzaEsecuzione && !navigator.onLine) {
        console.log("Sync annullata: il browser segnala ancora offline.");
        return;
    }

    // 2. Recupera l'elenco delle foto salvate offline
    const fotoPendenti = await StorageService.recuperaFotoPendenti();
    console.log("🔍 DEBUG Sincronizzazione: Trovate", fotoPendenti.length, "foto in sospeso.");

    if (fotoPendenti.length === 0) return;

    // 3. Mostra il popup personalizzato a 3 opzioni
    const risposta = await Popup.sync(
        "Foto in sospeso",
        `Sono presenti ${fotoPendenti.length} foto non caricate nel Drive. Caricarle ora?`
    );

    if (risposta === 'si') {
        Popup.toast("Sincronizzazione avviata...");
        let caricateConSuccesso = 0;

        for (const foto of fotoPendenti) {
            try {
                const base64Contenuto = await StorageService.leggiFotoLocale(foto.path);
                if (base64Contenuto) {
                    await DriveService.caricaFoto(base64Contenuto, foto.filename, foto.barcode);
                    await StorageService.eliminaFileLocale(foto.path);
                    caricateConSuccesso++;
                }
            } catch (erroreUpload) {
                console.error(`Impossibile sincronizzare il file ${foto.filename}:`, erroreUpload);
                // Se il token è scaduto, lo vedremo qui nel console.error
            }
        }
        
        Popup.alert("Sincronizzazione Terminata", `Caricate con successo ${caricateConSuccesso} foto su Google Drive.`);

    } else if (risposta === 'elimina') {
        const confermaCancellazione = await Popup.confirm(
            "Svuota Cache", 
            "Sei sicuro di voler eliminare definitivamente tutte le foto salvate sul dispositivo?"
        );
        if (confermaCancellazione) {
            for (const foto of fotoPendenti) {
                await StorageService.eliminaFileLocale(foto.path);
            }
            Popup.toast("Tutte le foto locali sono state eliminate.");
        }
    }
}

// Funzione centralizzata per caricare i file non ancora sincronizzati
async function sincronizzaTuttiIPendenti() {
    if (!navigator.onLine) return false;

    const fotoPendenti = await StorageService.recuperaFotoPendenti();
    if (fotoPendenti.length === 0) return true;

    let tuttoInviatoConSuccesso = true; // <-- CORRETTO (niente spazi!)

    for (const foto of fotoPendenti) {
        const giaInviato = await StorageService.isFileSincronizzato(foto.filename);
        if (!giaInviato) {
            try {
                const base64 = await StorageService.leggiFotoLocale(foto.path);
                if (base64) {
                    await DriveService.caricaFoto(base64, foto.filename, foto.barcode);
                    await StorageService.segnaComeSincronizzato(foto.filename);
                }
            } catch (err) {
                console.error("Errore caricamento file singolo:", foto.filename, err);
                tuttoInviatoConSuccesso = false;
            }
        }
    }
    return tuttoInviatoConSuccesso;
}

function inizializzaIndicatoreConnessione() {
    const barraStato = document.getElementById('connection-status');
    const testoStato = document.getElementById('connection-text');

    if (!barraStato || !testoStato) return;

    function aggiornaVisualizzazione(forzaOnline) {
        const statoOnline = (forzaOnline !== undefined) ? forzaOnline : navigator.onLine;

        if (statoOnline) {
            barraStato.classList.remove('status-offline');
            barraStato.classList.add('status-online');
            testoStato.innerText = "Online";
        } else {
            barraStato.classList.remove('status-online');
            barraStato.classList.add('status-offline');
            testoStato.innerText = "Offline";
        }
    }

    // FUNZIONE CORE: Gestisce il rientro sotto copertura di rete
    async function gestisciRitornoOnline() {
        aggiornaVisualizzazione(true);
        Popup.toast("Rete rilevata: ripristino sessione Drive..."); 
        
        try {
            // 1. RINNOVO TOKEN: Chiamiamo il plugin per generare un token fresco, 
            // sovrascrivendo quello vecchio/scaduto nelle Preferences.
            await DriveService.loginManuale(); 
        } catch (e) {
            console.error("Errore nel refresh del token al ritorno online:", e);
        }

        // 2. Diamo 1.5 secondi alla rete per stabilizzarsi, poi avviamo la sync 
        // passando 'true' per ignorare i falsi negativi di navigator.onLine
        setTimeout(() => {
            controllaESincronizzaFotoPendenti(true); 
        }, 1500);
    }

    // Ascoltatori Standard
    window.addEventListener('online', gestisciRitornoOnline);
    window.addEventListener('offline', () => aggiornaVisualizzazione(false));

    // Ascoltatore Nativo Capacitor (più affidabile su mobile)
    const Network = window.Capacitor?.Plugins?.Network;
    if (Network) {
        Network.addListener('networkStatusChange', (status) => {
            if (status.connected) {
                gestisciRitornoOnline();
            } else {
                aggiornaVisualizzazione(false);
            }
        });
    }

    aggiornaVisualizzazione();
}