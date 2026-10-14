package com.twkim.tinylegion.webqa;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "NativeGame")
public class NativeGamePlugin extends Plugin {
    private boolean exporting;

    @PluginMethod public void ready(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            ((MainActivity) getActivity()).webReady = true;
            call.resolve();
        });
    }

    @PluginMethod public void background(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            getActivity().moveTaskToBack(true);
            call.resolve();
        });
    }

    @PluginMethod public void exportSave(PluginCall call) {
        String contents = call.getString("contents");
        if (contents == null || contents.length() > 2000000) {
            call.reject("Invalid save data");
            return;
        }
        if (exporting) { call.reject("Export already open"); return; }
        exporting = true;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, "tiny-legion-save.json");
        try { startActivityForResult(call, intent, "saveCreated"); }
        catch (Exception error) { exporting = false; call.reject("Cannot open save picker", error); }
    }

    @ActivityCallback private void saveCreated(PluginCall call, ActivityResult result) {
        exporting = false;
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK) {
            call.resolve(new JSObject().put("cancelled", true));
            return;
        }
        if (data == null || data.getData() == null) { call.reject("No destination selected"); return; }
        try (OutputStream output = getContext().getContentResolver().openOutputStream(data.getData(), "wt")) {
            if (output == null) throw new IllegalStateException("No writable destination");
            output.write(call.getString("contents", "").getBytes(StandardCharsets.UTF_8));
            output.flush();
        } catch (Exception error) { call.reject("Cannot write save file", error); return; }
        call.resolve(new JSObject().put("cancelled", false));
    }
}
