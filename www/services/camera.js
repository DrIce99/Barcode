export const CameraService = {
    async catturaScatto() {
        const Camera = window.Capacitor?.Plugins?.Camera;
        if (!Camera) {
            await new Promise(r => setTimeout(r, 400));
            return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk"; 
        }
        const image = await Camera.getPhoto({
            quality: 80,
            allowEditing: false,
            resultType: 'base64',
            source: 'CAMERA'
        });
        return image.base64String;
    }
};