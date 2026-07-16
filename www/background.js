// www/background.js

addEventListener('controlloPeriodico', async (event) => {
    console.log("Sveglia background ricevuta!");

    try {
        const { StorageService } = await import('./services/storage.js');
        const { DriveService } = await import('./services/drive.js');

        // Risoluzione sicura di Capacitor in ambiente headless (self/globalThis)
        const getCapacitor = () => {
            if (typeof window !== 'undefined' && window.Capacitor) return window.Capacitor;
            if (typeof globalThis !== 'undefined' && globalThis.Capacitor) return globalThis.Capacitor;
            if (typeof self !== 'undefined' && self.Capacitor) return self.Capacitor;
            return null;
        };

        const cap = getCapacitor();
        if (!cap) {
            console.error("Capacitor non rilevato nel thread di background.");
            return;
        }

        const Preferences = cap.Plugins?.Preferences;
        let LocalNotifications = cap.Plugins?.LocalNotifications;

        // Fallback dinamico se i moduli non sono esposti globalmente
        if (!LocalNotifications) {
            try {
                const module = await import('@capacitor/local-notifications');
                LocalNotifications = module.LocalNotifications;
            } catch (e) {
                console.warn("Impossibile importare @capacitor/local-notifications:", e);
            }
        }

        if (!Preferences) {
            console.error("Plugin Preferences non disponibile in background.");
            return;
        }

        // Helper interno per inviare notifiche in modo silenzioso e sicuro
        const inviaNotificaSilenziosa = async (id, title, body) => {
            if (!LocalNotifications) {
                console.log(`[Notifica simulata] ${title} - ${body}`);
                return;
            }
            try {
                await LocalNotifications.createChannel({
                    id: 'silent-sync',
                    name: 'Sincronizzazione Silenziosa',
                    description: 'Canale per i controlli di sincronizzazione in background',
                    importance: 2, // LOW: Icona presente ma senza suoni o vibrazioni
                    sound: null,
                    vibration: false,
                    visibility: 1
                });

                await LocalNotifications.schedule({
                    notifications: [
                        {
                            title: title,
                            body: body,
                            id: id,
                            channelId: 'silent-sync',
                            sound: null
                        }
                    ]
                });
            } catch (err) {
                console.error("Errore nell'invio della notifica:", err);
            }
        };

        // 1. NOTIFICA INIZIALE DI VERIFICA
        await inviaNotificaSilenziosa(999, "Verifica Packing List", "Controllo sincronizzazione in corso...");

        // 2. GESTIONE ROUTINE DOMENICALE
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
                    try {
                        await DriveService.inviaEmailReport(fotoPendenti);
                        await StorageService.svuotaTuttoLocale(fotoPendenti);
                    } catch (cleanupErr) {
                        console.error("Errore durante l'invio report o pulizia locale:", cleanupErr);
                    }
                    
                    await Preferences.set({ key: 'ultimo_cleanup_domenica', value: stringaOggi });
                    await Preferences.set({ key: 'files_sincronizzati', value: JSON.stringify([]) });
                    await Preferences.set({ key: 'sync_check', value: 'true' });

                    await inviaNotificaSilenziosa(999, "Report Domenicale Inviato", "Verifica completata ed email inviata con successo.");
                }
                return;
            }
        }

        // 3. CONTROLLO STANDARD OGNI 15 MINUTI
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
                    await inviaNotificaSilenziosa(999, "Sincronizzazione Completata", `Caricate ${fileCaricatiOra} foto in sospeso su Google Drive.`);
                } else if (fotoPendenti.length === 0) {
                    // Cache già vuota
                    await Preferences.set({ key: 'sync_check', value: 'true' });
                    if (LocalNotifications) {
                        setTimeout(async () => {
                            await LocalNotifications.cancel({ notifications: [{ id: 999 }] });
                        }, 5000);
                    }
                }
            } else {
                await inviaNotificaSilenziosa(999, "Sincronizzazione Sospesa", "Dispositivo offline. Nuovo tentativo al rientro in rete.");
            }
        } else {
            // Se tutto è già sincronizzato, rimuovi la notifica dopo 5 secondi
            if (LocalNotifications) {
                setTimeout(async () => {
                    await LocalNotifications.cancel({ notifications: [{ id: 999 }] });
                }, 5000);
            }
        }

    } catch (error) {
        console.error("Errore nel ciclo di background:", error);
    }
});