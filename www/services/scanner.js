const Plugins = window.Capacitor?.Plugins;

export const ScannerService = {
    async scansiona() {
        if (!Plugins?.BarcodeScanning) {
            // Fallback PC Browser
            await new Promise(r => setTimeout(r, 400));
            return prompt("Codice simulato su PC:", "800123456") || null;
        }

        const status = await Plugins.BarcodeScanning.requestPermissions();
        if (status.camera !== 'granted') throw new Error("Permessi fotocamera negati.");

        const { barcodes } = await Plugins.BarcodeScanning.scan();
        return barcodes.length > 0 ? barcodes[0].rawValue : null;
    }
};