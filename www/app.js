import { ApiService } from './services/api.js';
import { ScannerService } from './services/scanner.js';
import { CameraService } from './services/camera.js';
import { Popup } from './services/popup.js';

// Definizioni degli Stati dell'Applicazione
const STATI = {
    ATTESA_AUTENTICAZIONE: '#view-auth',
    ATTESA_SCAN: '#view-scan',
    SESSIONE_FOTO: '#view-session'
};

let statoAttuale = STATI.ATTESA_AUTENTICAZIONE;
let sessioneAttiva = null; // Sarà azzerata ad ogni ciclo

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    configuraListenerBottoni();
    
    try {
        // Stato iniziale: login automatico invisibile
        await ApiService.login();
        Popup.toast("Connesso a Google Drive");
        transizioneA(STATI.ATTESA_SCAN);
    } catch (err) {
        Popup.alert("Errore", "Impossibile autenticare l'applicazione.");
    }
}

function configuraListenerBottoni() {
    document.getElementById('btn-scan').addEventListener('click', gestioneScansione);
    document.getElementById('btn-take-photo').addEventListener('click', gestioneScattoFoto);
    document.getElementById('btn-end-session').addEventListener('click', gestioneChiusuraSessione);
    document.getElementById('btn-cancel-session').addEventListener('click', gestioneAnnullaSessione);
}

// ==========================================
// LOGICA DEI FLUSSI ED EVENTI
// ==========================================

async function gestioneScansione() {
    try {
        const barcode = await ScannerService.scansiona();
        if (!barcode) return; // Operazione annullata dall'utente

        Popup.toast(`Codice identificato: ${barcode}`);
        
        // Entra in modalità creazione cartella sul server
        const cartella = await ApiService.createFolder(barcode);
        
        // Generazione del tipo di dato "Sessione" come suggerito
        sessioneAttiva = {
            barcode: barcode,
            folderId: cartella.folderId,
            fotoCaricate: 0
        };

        // Aggiorna l'interfaccia di scatto fissa
        document.getElementById('session-barcode').innerText = sessioneAttiva.barcode;
        document.getElementById('status-count').innerText = "0";
        document.getElementById('status-last-file').innerText = "Nessuno";
        
        transizioneA(STATI.SESSIONE_FOTO);

    } catch (error) {
        Popup.alert("Errore Scanner", error.message);
    }
}

async function gestioneScattoFoto() {
    if (!sessioneAttiva) return;

    const btnScatta = document.getElementById('btn-take-photo');
    const uploaderBox = document.getElementById('session-uploader');

    try {
        const base64Data = await CameraService.catturaScatto();
        if (!base64Data) return;

        // Blocco UI Interfaccia locale durante l'upload (Aspetta l'esito reale)
        btnScatta.disabled = true;
        uploaderBox.style.display = 'block';

        // Caricamento effettivo
        const risposta = await ApiService.uploadPhoto(base64Data, sessioneAttiva.folderId, sessioneAttiva.fotoCaricate);
        
        if (risposta.success) {
            sessioneAttiva.fotoCaricate++;
            
            // Aggiorna la barra di stato in tempo reale
            document.getElementById('status-count').innerText = sessioneAttiva.fotoCaricate;
            document.getElementById('status-last-file').innerText = risposta.filename;
            Popup.toast("✓ Foto salvata");
        }

    } catch (err) {
        Popup.alert("Errore Caricamento", "Scatto interrotto o problema di rete durante l'upload.");
    } finally {
        // Sblocca la UI e riporta l'operatore alla schermata principale di controllo dello scatto
        btnScatta.disabled = false;
        uploaderBox.style.display = 'none';
    }
}

async function gestioneChiusuraSessione() {
    const conferma = await Popup.confirm("Termina Sessione", `Hai acquisito ${sessioneAttiva.fotoCaricate} foto. Vuoi chiudere?`);
    if (!conferma) return;

    const folderUrl = `https://drive.google.com/drive/folders/${sessioneAttiva.folderId}`;
    
    // Reset completo della sessione (Previene bug di sovrascrittura)
    sessioneAttiva = null; 

    Popup.toast("Apertura archivio...");
    
    setTimeout(() => {
        window.open(folderUrl, '_system');
        // Ritorna allo stato di ATTESA_SCAN pronto per un nuovo ciclo, senza riavviare l'app!
        transizioneA(STATI.ATTESA_SCAN);
    }, 1000);
}

async function gestioneAnnullaSessione() {
    if (!sessioneAttiva) return;

    // Chiediamo conferma per evitare tocchi accidentali
    const conferma = await Popup.confirm(
        "Annulla Sessione", 
        "Vuoi tornare alla schermata iniziale? Nota: le foto eventualmente già scattate rimarranno salvate su Drive."
    );
    
    if (!conferma) return;

    // Reset completo dello stato e della sessione
    sessioneAttiva = null;
    window.idCartellaDriveReale = null;

    Popup.toast("Sessione resettata");
    
    // Ritorna direttamente allo stato iniziale di attesa scan
    transizioneA(STATI.ATTESA_SCAN);
}

// Engine della Macchina a Stati con Anime.js
function transizioneA(nuovoStato) {
    const elementoUscita = statoAttuale;
    statoAttuale = nuovoStato;

    anime({
        targets: elementoUscita,
        opacity: 0,
        translateY: -20,
        duration: 250,
        easing: 'easeInQuad',
        complete: () => {
            document.querySelector(elementoUscita).style.display = 'none';
            const entrata = document.querySelector(nuovoStato);
            entrata.style.display = 'block';
            
            anime({
                targets: nuovoStato,
                opacity: [0, 1],
                translateY: [20, 0],
                duration: 350,
                easing: 'easeOutQuad'
            });
        }
    });
}