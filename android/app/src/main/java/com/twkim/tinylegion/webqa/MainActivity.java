package com.twkim.tinylegion.webqa;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    boolean webReady;
    boolean appActive;
    private void hideSystemBars() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeGamePlugin.class);
        super.onCreate(savedInstanceState);
        hideSystemBars();
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (webReady && bridge != null) bridge.triggerWindowJSEvent("tiny-legion-back");
                else moveTaskToBack(true);
            }
        });
    }
    @Override public void onResume() {
        super.onResume();
        appActive = true;
        if (webReady && bridge != null) bridge.triggerWindowJSEvent("tiny-legion-app-state", "{\"isActive\":true}");
    }
    @Override public void onPause() {
        appActive = false;
        if (webReady && bridge != null) bridge.triggerWindowJSEvent("tiny-legion-app-state", "{\"isActive\":false}");
        super.onPause();
    }
    @Override public void onWindowFocusChanged(boolean focus) {
        super.onWindowFocusChanged(focus);
        if (focus) hideSystemBars();
    }
}
