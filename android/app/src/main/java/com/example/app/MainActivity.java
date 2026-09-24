package com.example.app;

import android.os.Bundle;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Emergency sirens are synthesized in the WebView via the Web Audio API.
        // By default the WebView only allows audio after a user gesture, which left
        // a receiver silent when an alert arrived without them tapping the screen
        // first. Allow it so the siren always plays while the app is open.
        Bridge bridge = getBridge();
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
        }
    }
}
