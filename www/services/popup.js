export const Popup = {
    alert: (title, message) => mostratePopup(title, message, false),
    confirm: (title, message) => mostratePopup(title, message, true),
    toast: (message, duration = 2000) => {
        // Creazione rapida di un piccolo toast a schermo
        const toast = document.createElement('div');
        toast.className = 'custom-toast';
        toast.innerText = message;
        document.body.appendChild(toast);
        
        anime({
            targets: toast,
            translateY: [-30, 0],
            opacity: [0, 1],
            duration: 300,
            easing: 'easeOutQuad',
            complete: () => {
                setTimeout(() => {
                    anime({
                        targets: toast,
                        opacity: 0,
                        translateY: -20,
                        duration: 200,
                        complete: () => toast.remove()
                    });
                }, duration);
            }
        });
    }
};

function mostratePopup(title, message, isConfirm) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-popup-overlay');
        const card = document.getElementById('custom-popup-card');
        const btnOk = document.getElementById('btn-popup-ok');
        const btnCancel = document.getElementById('btn-popup-cancel');

        document.getElementById('popup-title').innerText = title;
        document.getElementById('popup-message').innerText = message;
        btnCancel.style.display = isConfirm ? 'block' : 'none';

        overlay.style.display = 'flex';
        anime.timeline()
            .add({ targets: overlay, opacity: [0, 1], duration: 200, easing: 'linear' })
            .add({ targets: card, scale: [0.8, 1], opacity: [0, 1], duration: 300, easing: 'easeOutBack' }, '-=100');

        btnOk.onclick = () => chiudi(true);
        btnCancel.onclick = () => chiudi(false);

        function chiudi(risultato) {
            btnOk.onclick = null; btnCancel.onclick = null;
            anime({
                targets: overlay, opacity: 0, duration: 200, easing: 'linear',
                complete: () => { overlay.style.display = 'none'; resolve(risultato); }
            });
        }
    });
}