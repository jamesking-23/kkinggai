use tauri::{WebviewUrl, WebviewWindowBuilder};

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

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("KKINGG AI")
                .inner_size(1200.0, 800.0)
                .min_inner_size(800.0, 600.0)
                .on_navigation(|url| allow_in_window(url.as_str()))
                .build()?;
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
        assert!(!allow_in_window("https://kkingg-ai.vercel.app.evil.example/"));
        assert!(!allow_in_window("https://evil.example/"));
        assert!(!allow_in_window("https://kkingg-ai.vercel.app@evil.example/"));
        assert!(!allow_in_window("file:///etc/passwd"));
        assert!(!allow_in_window("javascript:alert(1)"));
        assert!(!allow_in_window("not a url"));
    }
}
