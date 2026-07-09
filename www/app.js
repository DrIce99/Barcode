// www/app.js

import { ScannerService } from './services/scanner.js';
import { CameraService } from './services/camera.js';
import { DriveService } from './services/drive.js';
import { Popup } from './services/popup.js';

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
    } else {
        statoAttuale = STATI.LOGIN_GOOGLE;
        transizioneA(STATI.LOGIN_GOOGLE);
    }    
}

function configuraListenerBottoni() {
    document.getElementById('btn-scan').addEventListener('click', gestioneScansione);
    document.getElementById('btn-take-photo').addEventListener('click', gestioneScattoFoto);
    document.getElementById('btn-cancel-session').addEventListener('click', gestioneAnnullaSessione);
    document.getElementById('btn-end-session').addEventListener('click', gestioneChiusuraSessione);
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
        if (!barcode) return; // Se l'operatore annulla lo scanner ad apertura fotocamera

        sessioneAttiva = {
            barcode: barcode,
            fotoCaricate: 0
        };

        document.getElementById('session-barcode').innerText = sessioneAttiva.barcode;
        document.getElementById('status-count').innerText = "0";
        document.getElementById('status-last-file').innerText = "Nessuno";
        
        transizioneA(STATI.SESSIONE_FOTO);

    } catch (error) {
        Popup.alert("Errore", error.message);
    }
}

async function gestioneScattoFoto() {
    if (!sessioneAttiva) return;

    const btnScatta = document.getElementById('btn-take-photo');
    const uploaderBox = document.getElementById('session-uploader');

    try {
        const base64Data = await CameraService.catturaScatto();
        if (!base64Data) return;

        btnScatta.disabled = true;
        uploaderBox.style.display = 'block';
        
        // Aggiorniamo il testo dell'interfaccia coerentemente col flusso cloud
        document.getElementById('uploader-text').innerText = "Caricamento su Google Drive...";

        // Generiamo il nome progressivo del file (es: 800123456_001.jpg)
        const nomeFile = `${sessioneAttiva.barcode}_${String(sessioneAttiva.fotoCaricate + 1).padStart(3, '0')}.jpg`;

        //   CARICAMENTO DIRETTO E UNICO SU GOOGLE DRIVE
        await DriveService.caricaFoto(base64Data, nomeFile, sessioneAttiva.barcode);

        // Se la chiamata fetch sopra non lancia errori, l'upload è andato a buon fine!
        sessioneAttiva.fotoCaricate++;
        document.getElementById('status-count').innerText = sessioneAttiva.fotoCaricate;
        document.getElementById('status-last-file').innerText = nomeFile;
        
        Popup.toast("✓ Caricata correttamente su Drive");

    } catch (err) {
        Popup.alert("Errore di Caricamento", err.message);
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
    await Popup.alert(
        "Sessione Completata", 
        `Hai archiviato correttamente ${sessioneAttiva.fotoCaricate} foto nella cartella 'Packing Lists/${sessioneAttiva.barcode}' su Google Drive.`
    );
    
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