use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

/// The only web origin the window may show besides its own bundled start page.
const SITE_HOST: &str = "kkingg-ai.vercel.app";

/// Decides whether the window may navigate to `url`: the bundled start page (any `tauri` or `http(s)://tauri.localhost`
/// address, which is how Tauri serves local files on each platform) and the hosted app over HTTPS only.
pub fn allow_in_window(url: &str) -> bool {
    let u = match url.parse::<url::Url>() {
        Ok(u) => u,
        Err(_) => return false,
    };
    match u.scheme() {
        "tauri" => true,
        "https" | "http" => {
            let host = u.host_str().unwrap_or("");
            host == "tauri.localhost" || (u.scheme() == "https" && host == SITE_HOST)
        }
        _ => false,
    }
}

/// Brings the main window back from the tray.
fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// Builds the tray icon with Show and Quit. Returns false if the platform could not create it, in which case the
/// window must keep its normal close behaviour so the app can still be quit.
fn build_tray(app: &AppHandle) -> bool {
    let build = || -> tauri::Result<()> {
        let show = MenuItem::with_id(app, "show", "Show KKINGG AI", true, None::<&str>)?;
        let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
        let menu = Menu::with_items(app, &[&show, &quit])?;
        let mut tray = TrayIconBuilder::new()
            .tooltip("KKINGG AI")
            .menu(&menu)
            .show_menu_on_left_click(false)
            .on_menu_event(|app, event| match event.id.as_ref() {
                "show" => show_main(app),
                "quit" => app.exit(0),
                _ => {}
            })
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    show_main(tray.app_handle());
                }
            });
        if let Some(icon) = app.default_window_icon() {
            tray = tray.icon(icon.clone());
        }
        tray.build(app)?;
        Ok(())
    };
    build().is_ok()
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let window =
                WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                    .title("KKINGG AI")
                    .inner_size(1200.0, 800.0)
                    .min_inner_size(800.0, 600.0)
                    .on_navigation(|url| allow_in_window(url.as_str()))
                    .build()?;
            // Closing the window hides it to the tray (Quit is in the tray menu), but only when the tray exists.
            if build_tray(app.handle()) {
                let w = window.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = w.hide();
                    }
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running KKINGG AI desktop");
}

#[cfg(test)]
mod tests {
    use super::allow_in_window;

    #[test]
    fn allows_the_start_page_and_the_hosted_app() {
        assert!(allow_in_window("tauri://localhost/index.html"));
        assert!(allow_in_window("http://tauri.localhost/index.html"));
        assert!(allow_in_window("https://tauri.localhost/"));
        assert!(allow_in_window("https://kkingg-ai.vercel.app/tasks"));
    }

    #[test]
    fn blocks_everything_else() {
        assert!(!allow_in_window("http://kkingg-ai.vercel.app/"));
        assert!(!allow_in_window(
            "https://kkingg-ai.vercel.app.evil.example/"
        ));
        assert!(!allow_in_window("https://evil.example/"));
        assert!(!allow_in_window(
            "https://kkingg-ai.vercel.app@evil.example/"
        ));
        assert!(!allow_in_window("file:///etc/passwd"));
        assert!(!allow_in_window("javascript:alert(1)"));
        assert!(!allow_in_window("not a url"));
    }
}
