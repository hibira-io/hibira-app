package io.hibira.app.push;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import io.hibira.push.PushCallback;
import io.hibira.push.PushCallbackError;
import io.hibira.push.PushNotifications;
import io.hibira.push.auth.TokenProvider;
import java.util.UUID;

/**
 * The Hibira app's native side on Android.
 *
 * <p>Notifications: after sign-in the portal page hands this plugin the
 * response of POST /api/v1/me/app-push ({ instance_id, endpoint, user_id,
 * token }); the phone registers with FCM through Hibira Push as that account.
 * Tapping a notice opens its page.
 *
 * <p>Links: the signed-in portal pages and its email links open the app as
 * App Links (hibira.io/.well-known/assetlinks.json); this loads them in
 * the web view, which keeps the session cookie.
 */
@CapacitorPlugin(
    name = "HibiraAppPush",
    permissions = {@Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})})
public class HibiraAppPushPlugin extends Plugin {
    static final String HOST = "hibira.io";
    /** Notification taps and app links open pages on these hosts only. */
    static final java.util.List<String> LINK_HOSTS = java.util.Arrays.asList(HOST, "approvals.hibira.io", "chat.hibira.io");
    private static final String PREFS = "hibira-app-push";
    private static final String USER = "user";

    @Override
    public void load() {
        AppMessagingService.channel(getContext());
        openFrom(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        openFrom(intent);
    }

    /** Loads a hibira.io link (an App Link, or a tapped notice's url). */
    private void openFrom(Intent intent) {
        if (intent == null) {
            return;
        }
        Uri uri = intent.getData();
        String extra = intent.getStringExtra("url");
        if (extra != null) {
            uri = Uri.parse(extra);
        }
        if (uri == null || !"https".equals(uri.getScheme()) || !LINK_HOSTS.contains(uri.getHost())) {
            return;
        }
        final String url = uri.toString();
        intent.setData(null);
        intent.removeExtra("url");
        getBridge().executeOnMainThread(() -> getBridge().getWebView().loadUrl(url));
    }

    @PluginMethod
    public void register(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "afterPermission");
            return;
        }
        doRegister(call);
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) {
        // Without the permission the device still registers; Android just
        // keeps the notices out of sight until it is granted in Settings.
        doRegister(call);
    }

    private void doRegister(PluginCall call) {
        String instanceId = call.getString("instance_id");
        String userId = call.getString("user_id");
        final String token = call.getString("token");
        if (instanceId == null || userId == null || userId.isEmpty() || token == null || token.isEmpty() || !isUUID(instanceId)) {
            call.reject("bad_request");
            return;
        }
        Context ctx = getContext().getApplicationContext();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String previous = prefs.getString(USER, null);
        String endpoint = call.getString("endpoint");
        if (endpoint != null && endpoint.startsWith("https://")) {
            PushNotifications.setEndpoint(ctx, endpoint);
        }
        PushNotifications.start(ctx, instanceId);
        if (previous != null && !previous.equals(userId)) {
            // Another account on this phone: start over.
            PushNotifications.clearAllState();
            PushNotifications.start(ctx, instanceId);
        }
        TokenProvider handed = new TokenProvider() {
            @Override
            public String fetchToken(String u) {
                return token;
            }
        };
        PushNotifications.setUserId(userId, handed, new PushCallback<Void, PushCallbackError>() {
            @Override
            public void onSuccess(Void... values) {
                prefs.edit().putString(USER, userId).apply();
                call.resolve(new JSObject());
            }

            @Override
            public void onFailure(PushCallbackError error) {
                call.reject(error.getMessage());
            }
        });
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        Context ctx = getContext().getApplicationContext();
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(USER).apply();
        try {
            PushNotifications.clearAllState();
        } catch (IllegalStateException notStarted) {
            // Never registered on this phone.
        }
        call.resolve();
    }

    private static boolean isUUID(String s) {
        try {
            UUID.fromString(s);
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
