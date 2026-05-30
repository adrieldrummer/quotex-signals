"""Teste: Patchright com stealth contra Cloudflare."""
import os
import asyncio
from dotenv import load_dotenv
from patchright.async_api import async_playwright

load_dotenv()
EMAIL = os.getenv("QUOTEX_EMAIL")
PWD = os.getenv("QUOTEX_PASSWORD")
print(f"Login: {EMAIL}")


async def main():
    async with async_playwright() as p:
        # Patchright recomenda HEADFUL (não headless) + persistent_context pra evitar Cloudflare
        user_data_dir = os.path.join(os.path.expanduser("~"), ".quotex_pw_profile")
        os.makedirs(user_data_dir, exist_ok=True)

        context = await p.chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            channel="chrome",  # tenta Chrome real, fallback chromium
            headless=False,    # CRITICAL — Cloudflare blokeia headless
            no_viewport=True,
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = context.pages[0] if context.pages else await context.new_page()

        print("1. Indo pra qxbroker.com/pt/sign-in...")
        try:
            await page.goto("https://qxbroker.com/pt/sign-in", wait_until="domcontentloaded", timeout=60000)
        except Exception as e:
            print(f"   goto warn: {e}")
        await asyncio.sleep(5)
        await page.screenshot(path="01_signin_page.png")
        print(f"   título: {await page.title()}")
        print(f"   url: {page.url}")

        # Detecta Cloudflare
        try:
            html = await page.content()
            if "Confirme que" in html or "verificação de segurança" in html or "Just a moment" in html:
                print("   ⚠ Cloudflare detectado — aguardando 15s pra resolver")
                await asyncio.sleep(15)
                await page.screenshot(path="01b_after_cf.png")
        except Exception:
            pass

        # Tenta achar input email
        try:
            print("2. Preenchendo email/senha...")
            await page.wait_for_selector('input[name="email"]:visible', timeout=20000)
            await page.fill('input[name="email"]:visible', EMAIL)
            await page.fill('input[name="password"]:visible', PWD)
            await page.screenshot(path="02_filled.png")

            print("3. Submetendo...")
            await page.click('button:has-text("Entrar")', timeout=5000)
            await asyncio.sleep(7)
            await page.screenshot(path="03_after_login.png")
            print(f"4. URL: {page.url}")
        except Exception as e:
            print(f"   FAIL: {e}")
            await page.screenshot(path="03_after_login.png")

        await context.close()


if __name__ == "__main__":
    asyncio.run(main())
