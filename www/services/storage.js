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
    async salvaFotoLocale(base64Data, barcode) {
        if (!getFilesystem()) {
            const idFinto = Math.floor(Math.random() * 100);
            return { success: true, filename: `${barcode}_${String(idFinto).padStart(3, '0')}.jpg` };
        }
        const folderPath = `Packing Lists/${barcode}`;
        let prossimoNumero = 1;
        try {
            const contenuto = await getFilesystem().readdir({ path: folderPath, directory: 'DOCUMENTS' });
            prossimoNumero = contenuto.files.length + 1;
        } catch (e) { /* Partiamo da 1 */ }

        const nomeFile = `${barcode}_${String(prossimoNumero).padStart(3, '0')}.jpg`;
        await getFilesystem().writeFile({
            path: `${folderPath}/${nomeFile}`,
            data: base64Data,
            directory: 'DOCUMENTS'
        });
        return { success: true, filename: nomeFile };
    }
};