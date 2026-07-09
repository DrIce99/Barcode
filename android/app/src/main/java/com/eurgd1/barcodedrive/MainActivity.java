package com.eurgd1.barcodedrive;

import android.content.pm.ApplicationInfo;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) { // Inizializza Capacitor
        super.onCreate(savedInstanceState);

        // Controlla se la build è modificabile (Debug) e abilita Chrome Inspect
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            if (0 != (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE)) {
                WebView.setWebContentsDebuggingEnabled(true);
            }
        }
    }
}
