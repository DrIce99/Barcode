// www/background.js
import { LocalNotifications } from '@capacitor/local-notifications';

addEventListener('controlloPeriodico', async (event) => {
    console.log("Sveglia background ricevuta!");

    try {
        const { StorageService } = await import('./services/storage.js');
        const { DriveService } = await import('./services/drive.js');
        const { Preferences } = window.Capacitor.Plugins;

        // 1. CREA IL CANALE SILENZIOSO (Necessario per Android)
        await LocalNotifications.createChannel({
            id: 'silent-sync',
            name: 'Sincronizzazione Silenziosa',
            description: 'Canale per i controlli di sincronizzazione in background',
            importance: 2, // 2 = LOW (mostra l'icona in alto ma NON suona e NON vibra)
            sound: null,
            vibration: false,
            visibility: 1 // Visibile nella schermata di blocco ma discreto
        });

        // 2. INVIA LA NOTIFICA SILENZIOSA DI AVVIO CHECK
        await LocalNotifications.schedule({
            notifications: [
                {
                    title: "Verifica Packing List",
                    body: "Controllo sincronizzazione in corso...",
                    id: 999, // ID fisso così la notifica si sovrascrive invece di accumularsi
                    channelId: 'silent-sync',
                    sound: null
                }
            ]
        });

        // 3. GESTIONE ROUTINE DOMENICALE
        const oggi = new Date();
        if (oggi.getDay() === 0) { // Domenica
            const { value: ultimoCleanup } = await Preferences.get({ key: 'ultimo_cleanup_domenica' });
            const stringaOggi = oggi.toDateString();

            if (ultimoCleanup !== stringaOggi) {
                const fotoPendenti = await StorageService.recuperaFotoPendenti();
                
                let syncCompletata = true;
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
                            syncCompletata = false;
                        }
                    }
                }
                
                if (syncCompletata) {
                    await DriveService.inviaEmailReport(fotoPendenti);
                    await StorageService.svuotaTuttoLocale(fotoPendenti);
                    
                    await Preferences.set({ key: 'ultimo_cleanup_domenica', value: stringaOggi });
                    await Preferences.set({ key: 'files_sincronizzati', value: JSON.stringify([]) });
                    await Preferences.set({ key: 'sync_check', value: 'true' });

                    // Aggiorna la notifica per dire che la domenica è stata gestita
                    await LocalNotifications.schedule({
                        notifications: [
                            {
                                title: "Report Domenicale Inviato",
                                body: "Verifica completata ed email inviata con successo.",
                                id: 999,
                                channelId: 'silent-sync',
                                sound: null
                            }
                        ]
                    });
                }
                return;
            }
        }

        // 4. CONTROLLO STANDARD OGNI 15 MINUTI
        const { value: check } = await Preferences.get({ key: 'sync_check' });

        if (check === 'false' || check === null) {
            if (navigator.onLine) {
                const fotoPendenti = await StorageService.recuperaFotoPendenti();
                let tuttoInviato = true;
                let fileCaricatiOra = 0;

                for (const foto of fotoPendenti) {
                    const giaInviato = await StorageService.isFileSincronizzato(foto.filename);
                    if (!giaInviato) {
                        try {
                            const base64 = await StorageService.leggiFotoLocale(foto.path);
                            if (base64) {
                                await DriveService.caricaFoto(base64, foto.filename, foto.barcode);
                                await StorageService.segnaComeSincronizzato(foto.filename);
                                fileCaricatiOra++;
                            }
                        } catch (err) {
                            tuttoInviato = false;
                        }
                    }
                }

                if (tuttoInviato && fotoPendenti.length > 0) {
                    await Preferences.set({ key: 'sync_check', value: 'true' });
                    
                    // Notifica di successo (sempre silenziosa)
                    await LocalNotifications.schedule({
                        notifications: [
                            {
                                title: "Sincronizzazione Completata",
                                body: `Caricate ${fileCaricatiOra} foto in sospeso su Google Drive.`,
                                id: 999,
                                channelId: 'silent-sync',
                                sound: null
                            }
                        ]
                    });
                }
            } else {
                // Se offline, aggiorna la notifica avvisando l'utente
                await LocalNotifications.schedule({
                    notifications: [
                        {
                            title: "Sincronizzazione Sospesa",
                            body: "Dispositivo offline. Nuovo tentativo al prossimo rientro in rete.",
                            id: 999,
                            channelId: 'silent-sync',
                            sound: null
                        }
                    ]
                });
            }
        } else {
            // Se check è true (tutto già sincronizzato), rimuovi la notifica di controllo dopo 5 secondi
            setTimeout(async () => {
                await LocalNotifications.cancel({ notifications: [{ id: 999 }] });
            }, 5000);
        }

    } catch (error) {
        console.error("Errore nel ciclo di background:", error);
    }
});