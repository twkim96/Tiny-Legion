package com.twkim.tinylegion.webqa;

import android.app.Activity;
import android.content.Intent;
import android.content.Context;
import android.os.Bundle;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@CapacitorPlugin(name = "NativeGame")
public class NativeGamePlugin extends Plugin {
    private boolean exporting;
    private String pendingSnapshot;

    private File snapshotFile(String name) {
        if (name == null || !name.matches("tiny-legion-export-[a-f0-9-]{36}\\.json")) return null;
        return new File(getContext().getNoBackupFilesDir(), name);
    }

    @Override protected Bundle saveInstanceState() {
        if (pendingSnapshot == null) return null;
        Bundle state = new Bundle();
        state.putString("snapshot", pendingSnapshot);
        return state;
    }

    @Override protected void restoreState(Bundle state) {
        pendingSnapshot = state.getString("snapshot");
        exporting = pendingSnapshot != null;
    }

    private void restoredResult(String status) {
        getContext().getSharedPreferences("tiny-legion-native", Context.MODE_PRIVATE)
            .edit().putString("exportResult", status).commit();
        if (((MainActivity) getActivity()).webReady)
            bridge.triggerWindowJSEvent("tiny-legion-export-restored");
    }

    @PluginMethod public void consumeExportResult(PluginCall call) {
        android.content.SharedPreferences prefs = getContext().getSharedPreferences("tiny-legion-native", Context.MODE_PRIVATE);
        String status = prefs.getString("exportResult", null);
        prefs.edit().remove("exportResult").commit();
        JSObject result = new JSObject();
        if (status != null) result.put("status", status);
        call.resolve(result);
    }

    @PluginMethod public void ready(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            MainActivity activity = (MainActivity) getActivity();
            activity.webReady = true;
            bridge.triggerWindowJSEvent("tiny-legion-app-state", "{\"isActive\":" + activity.appActive + "}");
            // A restored result may arrive after the first JS read but before
            // webReady. Drain once more when the receiver is fully ready.
            bridge.triggerWindowJSEvent("tiny-legion-export-restored");
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
        String name = "tiny-legion-export-" + UUID.randomUUID() + ".json";
        File snapshot = snapshotFile(name);
        try (OutputStream output = new FileOutputStream(snapshot)) {
            output.write(contents.getBytes(StandardCharsets.UTF_8));
            output.flush();
        } catch (Exception error) {
            if (snapshot != null) snapshot.delete();
            call.reject("Cannot prepare save file", error);
            return;
        }
        pendingSnapshot = name;
        // Capacitor saves call data in the Activity Bundle too. Keep the large
        // JSON in the private file so both saved copies contain only its ID.
        call.getData().remove("contents");
        call.getData().put("snapshot", name);
        exporting = true;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, "tiny-legion-save.json");
        try { startActivityForResult(call, intent, "saveCreated"); }
        catch (Exception error) {
            exporting = false; pendingSnapshot = null; snapshot.delete();
            call.reject("Cannot open save picker", error);
        }
    }

    @ActivityCallback private void saveCreated(PluginCall call, ActivityResult result) {
        exporting = false;
        File snapshot = snapshotFile(call == null ? pendingSnapshot : call.getString("snapshot"));
        pendingSnapshot = null;
        boolean restored = call == null || PluginCall.CALLBACK_ID_DANGLING.equals(call.getCallbackId());
        try {
            if (call == null) { restoredResult("failed"); return; }
            Intent data = result.getData();
            if (result.getResultCode() != Activity.RESULT_OK) {
                if (restored) restoredResult("cancelled");
                call.resolve(new JSObject().put("cancelled", true));
                return;
            }
            if (snapshot == null || data == null || data.getData() == null) throw new IllegalStateException("Missing save destination or snapshot");
            try (FileInputStream input = new FileInputStream(snapshot);
                 OutputStream output = getContext().getContentResolver().openOutputStream(data.getData(), "wt")) {
                if (output == null) throw new IllegalStateException("No writable destination");
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                output.flush();
            }
            if (restored) restoredResult("saved");
            call.resolve(new JSObject().put("cancelled", false));
        } catch (Exception error) {
            if (restored) restoredResult("failed");
            if (call != null) call.reject("Cannot write save file", error);
        } finally { if (snapshot != null) snapshot.delete(); }
    }
}
