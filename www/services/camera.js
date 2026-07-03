const Plugins = window.Capacitor?.Plugins;

export const CameraService = {
    async catturaScatto() {
        if (!Plugins?.Camera) {
            // Fallback PC Browser
            await new Promise(r => setTimeout(r, 500));
            return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk"; 
        }

        const image = await Plugins.Camera.getPhoto({
            quality: 75,
            allowEditing: false,
            resultType: 'base64',
            source: 'CAMERA'
        });
        return image.base64String;
    }
};