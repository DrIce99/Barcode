const getFilesystem = () => window.Capacitor?.Plugins?.Filesystem;

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
    }
};