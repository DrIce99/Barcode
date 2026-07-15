const getFilesystem = () => window.Capacitor?.Plugins?.Filesystem;
const getPreferences = () => window.Capacitor?.Plugins?.Preferences;

export const StorageService = {
    async inizializza() {
        if (!getFilesystem()) {
            console.log("[Storage Mock] PC rilevato. Cartella 'Packing Lists' simulata.");
            return;
        }
        try {
            await getFilesystem().mkdir({
                path: 'Packing Lists',
                directory: 'DOCUMENTS',
                recursive: true
            });
        } catch (error) {
            console.error("[Storage] Errore inizializzazione:", error);
        }
    },
    async creaCartellaBarcode(barcode) {
        if (!getFilesystem()) return { success: true };
        try {
            await getFilesystem().mkdir({
                path: `Packing Lists/${barcode}`,
                directory: 'DOCUMENTS',
                recursive: false
            });
        } catch (e) { /* Ignora se esiste già */ }
        return { success: true };
    },
    async salvaFotoLocale(base64Data, barcode, nomeFile) {
        if (!getFilesystem()) {
            return { success: true, filename: nomeFile };
        }

        const folderPath = `Packing Lists/${barcode}`;

        // Utilizziamo direttamente il nomeFile generato centralmente in app.js
        await getFilesystem().writeFile({
            path: `${folderPath}/${nomeFile}`,
            data: base64Data,
            directory: 'DOCUMENTS'
        });

        return { success: true, filename: nomeFile };
    },
    // Scansiona la cartella 'Packing Lists' e recupera ricorsivamente tutte le foto salvate offline
    async recuperaFotoPendenti() {
        const fs = getFilesystem();
        if (!fs) return [];
        const listaCompleta = [];
        try {
            // 🟩 Sostituito Directory.Documents con 'DOCUMENTS'
            const root = await fs.readdir({ path: 'Packing Lists', directory: 'DOCUMENTS' });

            for (const cartella of root.files) {
                const nomeCartella = typeof cartella === 'string' ? cartella : cartella.name;
                if (nomeCartella === '.' || nomeCartella === '..') continue;

                try {
                    // 🟩 Sostituito Directory.Documents con 'DOCUMENTS'
                    const sottoCartella = await fs.readdir({
                        path: `Packing Lists/${nomeCartella}`,
                        directory: 'DOCUMENTS'
                    });

                    for (const file of sottoCartella.files) {
                        const nomeFile = typeof file === 'string' ? file : file.name;
                        const tipo = typeof file === 'string' ? 'file' : file.type;

                        if (tipo === 'file') {
                            listaCompleta.push({
                                barcode: nomeCartella,
                                filename: nomeFile,
                                path: `Packing Lists/${nomeCartella}/${nomeFile}`
                            });
                        }
                    }
                } catch (e) {
                    // Salta eventuali cartelle non leggibili
                }
            }
        } catch (error) {
            console.log("[Storage] Nessuna foto pendente o errore di lettura:", error);
        }
        return listaCompleta;
    },

    // Legge il file locale e lo converte in stringa Base64 pronta per il Drive
    async leggiFotoLocale(percorsoFile) {
        if (!getFilesystem()) return null;
        const risultato = await getFilesystem().readFile({
            path: percorsoFile,
            directory: 'DOCUMENTS'
        });
        return risultato.data;
    },

    // Rimuove la foto dal dispositivo dopo l'upload
    async eliminaFileLocale(percorsoFile) {
        if (!getFilesystem()) return;
        await getFilesystem().deleteFile({
            path: percorsoFile,
            directory: 'DOCUMENTS'
        });
    },

    // Registro locale dei file già inviati con successo
    async segnaComeSincronizzato(filename) {
        if (!getPreferences()) return;
        const { value } = await getPreferences().get({ key: 'files_sincronizzati' });
        const libreria = value ? JSON.parse(value) : [];
        if (!libreria.includes(filename)) {
            libreria.push(filename);
            await getPreferences().set({ key: 'files_sincronizzati', value: JSON.stringify(libreria) });
        }
    },

    async isFileSincronizzato(filename) {
        if (!getPreferences()) return false;
        const { value } = await getPreferences().get({ key: 'files_sincronizzati' });
        const libreria = value ? JSON.parse(value) : [];
        return libreria.includes(filename);
    },

    // Elimina fisicamente l'elenco dei file passati (usato la domenica)
    async svuotaTuttoLocale(listaFoto) {
        const fs = getFilesystem();
        if (!fs) return;
        for (const foto of listaFoto) {
            try {
                await fs.deleteFile({
                    path: foto.path,
                    directory: 'DOCUMENTS'
                });
            } catch (e) {
                console.error("Impossibile eliminare il file locale:", foto.path, e);
            }
        }
    }
};