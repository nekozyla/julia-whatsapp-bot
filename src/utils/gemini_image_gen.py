#!/usr/bin/env python3
"""
Gemini Image Generation via Selenium
Downloads the actual image - waits for download before closing.
"""

import sys
import os
import time
import glob
import shutil
import subprocess
import json
import platform
import urllib.request
import zipfile
import tempfile
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
DEFAULT_CHROME_BINARY_PATH = os.path.join(PROJECT_ROOT, "chromium_arm_final", "chrome-linux", "chrome")
CHROME_BINARY_PATH = os.environ.get("CHROME_BINARY_PATH", DEFAULT_CHROME_BINARY_PATH)
COOKIES_PATH = os.path.join(SCRIPT_DIR, "cookies.txt")
HOME_DIR = os.path.expanduser("~")
OUTPUT_DIR = os.environ.get("GEMINI_OUTPUT_DIR", os.path.join(PROJECT_ROOT, "temp", "generated_images"))
DOWNLOAD_DIR = os.environ.get("GEMINI_DOWNLOAD_DIR", os.path.join(HOME_DIR, "Downloads"))
TELEGRAM_BOT = "8665636042:AAFvWZsGF13hrt-eKADHrVYem8ZSF5oXjB0"
TELEGRAM_CHAT = "987723422"
DRIVER_CACHE_DIR = os.path.join(PROJECT_ROOT, "temp", "drivers")
LAST_KNOWN_GOOD_URL = "https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json"


def get_platform_tags():
    """Return preferred Chrome-for-Testing platform tags for current host."""
    system_name = platform.system().lower()
    machine = platform.machine().lower()

    if system_name == "linux":
        if machine in ("x86_64", "amd64"):
            return ["linux64"]
        if machine in ("aarch64", "arm64"):
            return ["linux-arm64"]

    if system_name == "darwin":
        if machine in ("arm64", "aarch64"):
            return ["mac-arm64", "mac-x64"]
        return ["mac-x64"]

    if system_name == "windows":
        return ["win64", "win32"]

    return []


def is_usable_chromedriver_path(driver_path):
    """Check whether a chromedriver path exists (execution is validated later)."""
    if not driver_path or not os.path.exists(driver_path):
        return False
    return True


def download_chromedriver():
    """Download chromedriver from Chrome-for-Testing into local cache."""
    os.makedirs(DRIVER_CACHE_DIR, exist_ok=True)
    platform_tags = get_platform_tags()
    if not platform_tags:
        return None

    with urllib.request.urlopen(LAST_KNOWN_GOOD_URL, timeout=20) as response:
        metadata = json.load(response)

    channels = metadata.get("channels", {})
    stable = channels.get("Stable", {})
    downloads = stable.get("downloads", {}).get("chromedriver", [])

    selected = None
    for tag in platform_tags:
        selected = next((item for item in downloads if item.get("platform") == tag), None)
        if selected:
            break

    if not selected:
        return None

    url = selected.get("url")
    if not url:
        return None

    with tempfile.TemporaryDirectory(prefix="chromedriver_dl_") as tmpdir:
        zip_path = os.path.join(tmpdir, "chromedriver.zip")
        urllib.request.urlretrieve(url, zip_path)

        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(tmpdir)

        extracted_driver = None
        for root, _, files in os.walk(tmpdir):
            for name in files:
                if name == "chromedriver":
                    extracted_driver = os.path.join(root, name)
                    break
            if extracted_driver:
                break

        if not extracted_driver:
            return None

        target_path = os.path.join(DRIVER_CACHE_DIR, "chromedriver")
        shutil.copy2(extracted_driver, target_path)
        os.chmod(target_path, 0o755)
        return target_path


def find_chromedriver():
    """Resolve a chromedriver binary path without relying on Selenium Manager."""
    env_path = os.environ.get("CHROMEDRIVER_PATH")
    if env_path and is_usable_chromedriver_path(env_path):
        return env_path

    candidates = [
        "/usr/local/bin/chromedriver",
        "/usr/bin/chromedriver",
        "/snap/bin/chromedriver",
        os.path.join(HOME_DIR, ".local", "bin", "chromedriver"),
        os.path.join(PROJECT_ROOT, "chromedriver"),
        os.path.join(PROJECT_ROOT, "bin", "chromedriver"),
        os.path.join(PROJECT_ROOT, "node_modules", ".bin", "chromedriver"),
        os.path.join(PROJECT_ROOT, "node_modules", "chromedriver", "bin", "chromedriver"),
        os.path.join(PROJECT_ROOT, "node_modules", "chromedriver", "lib", "chromedriver", "chromedriver"),
        os.path.join(PROJECT_ROOT, "chromium_arm_final", "chromedriver"),
        os.path.join(PROJECT_ROOT, "chromium_arm_final", "chrome-linux", "chromedriver"),
        os.path.join(DRIVER_CACHE_DIR, "chromedriver"),
    ]

    for candidate in candidates:
        if is_usable_chromedriver_path(candidate):
            return candidate

    chromium_root = os.path.join(PROJECT_ROOT, "chromium_arm_final")
    if os.path.isdir(chromium_root):
        for root, _, files in os.walk(chromium_root):
            for name in files:
                if name == "chromedriver":
                    full_path = os.path.join(root, name)
                    if is_usable_chromedriver_path(full_path):
                        return full_path

    # Busca caminhos comuns de portables/caches (inclui Playwright local do usuário).
    home_scan_roots = [
        os.path.join(HOME_DIR, ".cache", "ms-playwright"),
        os.path.join(HOME_DIR, ".cache", "puppeteer"),
        os.path.join(HOME_DIR, "playwright"),
        os.path.join(HOME_DIR, "chatbot", "bin"),
    ]
    for scan_root in home_scan_roots:
        if not os.path.isdir(scan_root):
            continue
        for root, _, files in os.walk(scan_root):
            for name in files:
                if name != "chromedriver":
                    continue
                full_path = os.path.join(root, name)
                if is_usable_chromedriver_path(full_path):
                    return full_path

    cached_driver = os.path.join(DRIVER_CACHE_DIR, "chromedriver")
    if os.path.exists(cached_driver) and not is_usable_chromedriver_path(cached_driver):
        try:
            os.remove(cached_driver)
        except Exception:
            pass

    try:
        downloaded = download_chromedriver()
        if downloaded and is_usable_chromedriver_path(downloaded):
            return downloaded
        if downloaded and os.path.exists(downloaded):
            try:
                os.remove(downloaded)
            except Exception:
                pass
    except Exception as e:
        print(f"⚠️ Falha no download automático do chromedriver: {e}")

    return None


def apply_stealth(driver):
    """Reduce obvious WebDriver fingerprints in Chromium."""
    try:
        driver.execute_cdp_cmd(
            "Page.addScriptToEvaluateOnNewDocument",
            {
                "source": """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
window.chrome = window.chrome || { runtime: {} };
"""
            },
        )
    except Exception:
        pass


def load_netscape_cookies(file_path):
    """Parse cookies in Netscape cookie file format."""
    cookies = []
    if not os.path.exists(file_path):
        return cookies

    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            parts = line.split("\t")
            if len(parts) < 7:
                continue

            domain, _, path, secure, expires, name, value = parts[:7]
            cookie = {
                "domain": domain,
                "path": path,
                "secure": secure.upper() == "TRUE",
                "name": name,
                "value": value,
            }

            try:
                exp = int(expires)
                if exp > 0:
                    cookie["expiry"] = exp
            except ValueError:
                pass

            cookies.append(cookie)

    return cookies


def inject_cookies(driver, cookies):
    """Inject cookies into the active browser session for Gemini/Google domains."""
    if not cookies:
        return

    driver.get("https://gemini.google.com")
    time.sleep(2)

    for cookie in cookies:
        domain = cookie.get("domain", "")
        if "google.com" not in domain and "gemini.google.com" not in domain:
            continue

        sanitized = dict(cookie)
        if sanitized.get("domain", "").startswith("."):
            sanitized["domain"] = sanitized["domain"][1:]

        try:
            driver.add_cookie(sanitized)
        except Exception:
            continue

def get_recent_files(folder, seconds=120):
    """Get files modified in the last N seconds."""
    now = time.time()
    files = []
    for f in glob.glob(os.path.join(folder, "*")):
        if os.path.isfile(f) and not f.endswith('.part'):
            mtime = os.path.getmtime(f)
            if now - mtime < seconds:
                files.append(f)
    return files

def find_input(driver, timeout=15):
    wait = WebDriverWait(driver, timeout)
    for sel in ["div.ql-editor[contenteditable='true']", "textarea",
                "[data-placeholder*='Peça']", "[data-placeholder*='Enter']"]:
        try:
            return wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, sel)))
        except:
            continue
    raise Exception("Input not found")

def find_generated_images(driver):
    """Find large images in the Gemini response (not profile icons)."""
    images = driver.find_elements(By.TAG_NAME, "img")
    results = []
    for img in images:
        try:
            src = img.get_attribute("src") or ""
            w = img.size.get('width', 0)
            h = img.size.get('height', 0)
            # Filter: must be large and look like generated content
            if w > 200 and h > 150 and "avatar" not in src and "profile" not in src:
                results.append(img)
        except:
            continue
    return results

def generate(prompt):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe = prompt[:30].replace(" ", "_").replace("/", "_").replace("'", "")
    
    # Record files in Downloads BEFORE
    files_before = set(glob.glob(os.path.join(DOWNLOAD_DIR, "*")))
    
    print(f"🎨 Abrindo Gemini...")
    options = Options()
    if not os.path.exists(CHROME_BINARY_PATH):
        raise FileNotFoundError(
            f"Chromium não encontrado em: {CHROME_BINARY_PATH}. "
            "Instale o navegador local usado pelo comando brat."
        )

    options.binary_location = CHROME_BINARY_PATH

    # Mantém cache de sessão em perfil local dedicado ao Gemini.
    gemini_profile = os.path.join(PROJECT_ROOT, "temp", "gemini_chrome_profile")
    os.makedirs(gemini_profile, exist_ok=True)
    options.add_argument(f"--user-data-dir={gemini_profile}")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-setuid-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--lang=pt-BR")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    
    prefs = {
        "download.default_directory": DOWNLOAD_DIR,
        "download.prompt_for_download": False,
        "download.directory_upgrade": True,
        "safebrowsing.enabled": True,
    }
    options.add_experimental_option("prefs", prefs)

    chrome_driver = find_chromedriver()
    if not chrome_driver:
        raise FileNotFoundError(
            "Chromedriver não encontrado (o download automático também falhou). "
            "Defina CHROMEDRIVER_PATH ou instale um binário compatível com a arquitetura do servidor "
            "(ex.: evitar driver x64 em host aarch64). "
            "Dica: find $HOME -type f -name chromedriver 2>/dev/null"
        )

    # Garante permissão de execução quando possível antes de iniciar o Selenium.
    try:
        os.chmod(chrome_driver, 0o755)
    except Exception:
        pass

    print(f"ℹ️ Usando chromedriver: {chrome_driver}")

    service = Service(chrome_driver)
    driver = webdriver.Chrome(service=service, options=options)
    apply_stealth(driver)
    
    try:
        cookies = load_netscape_cookies(COOKIES_PATH)
        if cookies:
            inject_cookies(driver, cookies)

        driver.get("https://gemini.google.com")
        time.sleep(5)
        
        input_box = find_input(driver)
        input_box.click()
        time.sleep(0.5)
        input_box.send_keys(f"Crie uma imagem: {prompt}")
        time.sleep(0.5)
        
        try:
            driver.find_element(By.CSS_SELECTOR, 
                "button[aria-label*='Submit'], button[aria-label*='Enviar']").click()
        except:
            input_box.send_keys(Keys.ENTER)
        
        print(f"⏳ Aguardando geração (até 3 minutos)...")
        
        # Wait for a LARGE image to appear - images in Gemini are typically >300px wide
        found = False
        last_check_count = 0
        stable_count = 0  # track if image is "stable" (not still loading/changing)
        
        for attempt in range(36):  # up to 180s (3 min)
            time.sleep(5)
            elapsed = (attempt + 1) * 5
            
            imgs = find_generated_images(driver)
            
            # Filter for truly large images (>300px wide, >200px tall)
            large_imgs = []
            for img in imgs:
                try:
                    w = img.size.get('width', 0)
                    h = img.size.get('height', 0)
                    src = img.get_attribute("src") or ""
                    
                    # Must be large and look like generated content
                    if w > 300 and h > 200:
                        # Check it's not a loading placeholder
                        if "data:image" not in src and "svg" not in src:
                            large_imgs.append(img)
                except:
                    continue
            
            if large_imgs:
                # Image found! But let's make sure it's stable (not still loading)
                current_count = len(large_imgs)
                if current_count == last_check_count:
                    stable_count += 1
                else:
                    stable_count = 0
                last_check_count = current_count
                
                if stable_count >= 2:  # stable for at least 2 checks (10s)
                    print(f"✅ Imagem detectada e estável após {elapsed}s ({len(large_imgs)} imagens)")
                    found = True
                    break
                else:
                    sizes = [(int(i.size['width']), int(i.size['height'])) for i in large_imgs]
                    print(f"⏳ {elapsed}s... imagem detectada {sizes}, aguardando estabilizar ({stable_count}/2)")
            else:
                print(f"⏳ {elapsed}s... gerando texto/imagem")
        
        if not found:
            print("⚠️ Imagem não detectada em 180s")
            filepath = os.path.join(OUTPUT_DIR, f"gemini_{safe}_{timestamp}.png")
            driver.save_screenshot(filepath)
            return filepath
        
        img = large_imgs[0]
        
        # Scroll to the confirmed large image
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", img)
        time.sleep(2)
        
        # Hover over image to reveal download button
        print("🖱️ Passando mouse sobre a imagem...")
        actions = ActionChains(driver)
        actions.move_to_element(img).perform()
        time.sleep(3)
        
        # Look for the download button
        download_btn = None
        for sel in [
            "button[aria-label*='Baixar']",
            "button[aria-label*='Download']",
            "button[aria-label*='baixar']",
            "button[aria-label*='download']",
        ]:
            try:
                btns = driver.find_elements(By.CSS_SELECTOR, sel)
                for btn in btns:
                    if btn.is_displayed():
                        download_btn = btn
                        break
                if download_btn:
                    break
            except:
                continue
        
        if download_btn:
            print(f"📥 Clicando no botão de download...")
            download_btn.click()
            
            # WAIT for download to complete
            print("⏳ Aguardando download completar...")
            max_wait = 60
            start_wait = time.time()
            downloaded_file = None
            
            while time.time() - start_wait < max_wait:
                time.sleep(3)
                elapsed = int(time.time() - start_wait)
                
                # Check for new files
                files_after = set(glob.glob(os.path.join(DOWNLOAD_DIR, "*")))
                new_files = files_after - files_before
                
                # Filter out .part (incomplete) and lock files
                completed = [f for f in new_files if not f.endswith('.part') 
                            and not f.endswith('.crdownload')
                            and os.path.getsize(f) > 1000]
                
                # Also check no .part files still exist (download in progress)
                partial = [f for f in new_files if f.endswith('.part')]
                
                if completed and not partial:
                    downloaded_file = max(completed, key=os.path.getmtime)
                    print(f"✅ Download completo após {elapsed}s!")
                    break
                
                if partial:
                    size = os.path.getsize(partial[0]) if partial else 0
                    print(f"⏳ {elapsed}s... baixando ({size/1024:.0f}KB)")
                else:
                    print(f"⏳ {elapsed}s... aguardando")
            
            if downloaded_file:
                # Copy to output directory
                ext = os.path.splitext(downloaded_file)[1] or '.png'
                dest = os.path.join(OUTPUT_DIR, f"gemini_{safe}_{timestamp}{ext}")
                shutil.copy2(downloaded_file, dest)
                print(f"📁 Imagem salva: {dest}")
                return dest
            else:
                print("⚠️ Download não completou a tempo")
        else:
            print("⚠️ Botão de download não encontrado")
        
        # Fallback: screenshot
        filepath = os.path.join(OUTPUT_DIR, f"gemini_{safe}_{timestamp}.png")
        driver.save_screenshot(filepath)
        print(f"📸 Fallback screenshot: {filepath}")
        return filepath
        
    finally:
        driver.quit()

def send_telegram(image_path, caption):
    cmd = ["curl", "-s", "-X", "POST",
           f"https://api.telegram.org/bot{TELEGRAM_BOT}/sendPhoto",
           "-F", f"chat_id={TELEGRAM_CHAT}",
           "-F", f"photo=@{image_path}",
           "-F", f"caption={caption}"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return "ok" in result.stdout

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python3 gemini_image_gen.py 'descrição'")
        sys.exit(1)
    
    prompt = " ".join(sys.argv[1:])
    result = generate(prompt)
    
    caption = f"🎨 Gemini: {prompt}"
    if send_telegram(result, caption):
        print("📱 Enviado!")
    print(f"\n✅ {result}")
